package com.procureiq.strategicalignment;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.strategicokr.StrategicHealth;
import com.procureiq.strategicokr.StrategicObjectiveStatus;
import com.procureiq.strategicokr.StrategicOkrMathService;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class StrategicAlignmentService {

    private final StrategicAlignmentRepository repository;

    private final StrategicAlignmentScoringService scoringService;

    private final StrategicOkrMathService okrMathService;

    private final AppUserRepository appUserRepository;

    public StrategicAlignmentService(
            StrategicAlignmentRepository repository,
            StrategicAlignmentScoringService scoringService,
            StrategicOkrMathService okrMathService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.scoringService =
                scoringService;

        this.okrMathService =
                okrMathService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public StrategicAlignmentDashboardResponse dashboard(
            UUID currentUserId,
            String currency,
            int fiscalYear
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        LiveAlignment live =
                liveAlignment(
                        normalizedCurrency,
                        fiscalYear
                );

        return new StrategicAlignmentDashboardResponse(
                normalizedCurrency,
                fiscalYear,
                live.summary(),
                live.objectives(),
                live.sources(),
                repository
                        .reviews(
                                normalizedCurrency,
                                fiscalYear
                        )
                        .stream()
                        .map(
                                this::reviewSummary
                        )
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public ObjectiveAlignmentDetailResponse objective(
            UUID currentUserId,
            UUID objectiveId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicAlignmentRepository.ObjectiveRow objective =
                requireObjective(
                        objectiveId
                );

        List<AlignmentPortfolioItem> portfolio =
                repository
                        .portfolioItems(
                                objectiveCurrency(
                                        objectiveId
                                )
                        );

        return new ObjectiveAlignmentDetailResponse(
                objectiveSummary(
                        objective,
                        portfolio
                ),
                repository
                        .linksForObjective(
                                objectiveId
                        )
                        .stream()
                        .map(
                                this::linkResponse
                        )
                        .toList(),
                portfolio.stream()
                        .map(
                                this::sourceResponse
                        )
                        .toList()
        );
    }

    public AlignmentLinkResponse createLink(
            UUID currentUserId,
            UUID objectiveId,
            StrategicAlignmentLinkInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicAlignmentRepository.ObjectiveRow objective =
                requireObjective(
                        objectiveId
                );

        if (
                objective.status()
                        == StrategicObjectiveStatus.ACHIEVED
                ||
                objective.status()
                        == StrategicObjectiveStatus.CLOSED
                ||
                objective.status()
                        == StrategicObjectiveStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Finalized strategic objectives cannot receive new alignment links."
            );
        }

        String currency =
                objectiveCurrency(
                        objectiveId
                );

        AlignmentPortfolioItem source =
                repository
                        .portfolioItems(
                                currency
                        )
                        .stream()
                        .filter(
                                candidate ->
                                        candidate.sourceType()
                                                == input.sourceType()
                                        &&
                                        candidate.sourceEntityId()
                                                .equals(
                                                        input.sourceEntityId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Selected strategic work item is not currently eligible for alignment."
                                        )
                        );

        List<StrategicAlignmentRepository.LinkRow> existingLinks =
                repository
                        .linksForSource(
                                input.sourceType(),
                                input.sourceEntityId()
                        );

        if (
                existingLinks.stream()
                        .anyMatch(
                                link ->
                                        link.objectiveId()
                                                .equals(
                                                        objectiveId
                                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "This work item is already linked to the selected objective."
            );
        }

        BigDecimal existingAllocation =
                existingLinks.stream()
                        .map(
                                StrategicAlignmentRepository.LinkRow::
                                        allocationPct
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal resultingAllocation =
                existingAllocation
                        .add(
                                input.allocationPct()
                        );

        if (
                resultingAllocation.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Strategic work allocation across objectives cannot exceed 100%."
            );
        }

        UUID linkId =
                UUID.randomUUID();

        repository.createLink(
                linkId,
                objectiveId,
                input,
                source,
                currentUserId
        );

        return linkResponse(
                repository
                        .findLink(
                                linkId
                        )
        );
    }

    public void deleteLink(
            UUID currentUserId,
            UUID linkId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicAlignmentRepository.LinkRow link =
                repository
                        .findLink(
                                linkId
                        );

        if (link == null) {
            throw new ResourceNotFoundException(
                    "Strategic alignment link not found: "
                            + linkId
            );
        }

        StrategicAlignmentRepository.ObjectiveRow objective =
                requireObjective(
                        link.objectiveId()
                );

        if (
                objective.status()
                        == StrategicObjectiveStatus.ACHIEVED
                ||
                objective.status()
                        == StrategicObjectiveStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Alignment links for finalized objectives cannot be removed."
            );
        }

        repository.deleteLink(
                linkId
        );
    }

    public AlignmentReviewDetailResponse captureReview(
            UUID currentUserId,
            String currency,
            int fiscalYear
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        LiveAlignment live =
                liveAlignment(
                        normalizedCurrency,
                        fiscalYear
                );

        UUID reviewId =
                UUID.randomUUID();

        repository.createReview(
                reviewId,
                nextReviewNumber(),
                normalizedCurrency,
                fiscalYear,
                live.summary(),
                currentUserId
        );

        for (
                AlignmentSourceResponse source
                : live.sources()
        ) {
            repository.createReviewItem(
                    reviewId,
                    source
            );
        }

        return review(
                currentUserId,
                reviewId
        );
    }

    @Transactional(readOnly = true)
    public AlignmentReviewDetailResponse review(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicAlignmentRepository.ReviewRow row =
                repository
                        .findReview(
                                reviewId
                        );

        if (row == null) {
            throw new ResourceNotFoundException(
                    "Strategic alignment review not found: "
                            + reviewId
            );
        }

        StrategicAlignmentSummaryResponse summary =
                summaryFromReview(
                        row
                );

        return new AlignmentReviewDetailResponse(
                reviewSummary(
                        row
                ),
                summary,
                repository
                        .reviewItems(
                                reviewId
                        )
                        .stream()
                        .map(
                                this::reviewItemResponse
                        )
                        .toList()
        );
    }

    private LiveAlignment liveAlignment(
            String currency,
            int fiscalYear
    ) {
        List<StrategicAlignmentRepository.ObjectiveRow> objectives =
                repository
                        .objectives(
                                currency,
                                fiscalYear
                        );

        List<AlignmentPortfolioItem> portfolio =
                repository
                        .portfolioItems(
                                currency
                        );

        List<AlignmentSourceResponse> sources =
                portfolio.stream()
                        .map(
                                this::sourceResponse
                        )
                        .toList();

        List<ObjectiveAlignmentSummaryResponse> objectiveResponses =
                objectives.stream()
                        .map(
                                objective ->
                                        objectiveSummary(
                                                objective,
                                                portfolio
                                        )
                        )
                        .toList();

        int objectivesWithAlignment =
                (
                        int
                ) objectiveResponses.stream()
                        .filter(
                                objective ->
                                        objective.linkedSourceCount()
                                                > 0
                        )
                        .count();

        List<AlignmentItemMetric> metrics =
                sources.stream()
                        .map(
                                source ->
                                        new AlignmentItemMetric(
                                                source.strategicValue(),
                                                source.riskExposure(),
                                                source.directAllocationPct(),
                                                source.linkedObjectiveCount(),
                                                source.deadlineConflictCount()
                                        )
                        )
                        .toList();

        AlignmentScoreResult score =
                scoringService
                        .score(
                                metrics,
                                objectives.size(),
                                objectivesWithAlignment
                        );

        int alignedCount =
                (
                        int
                ) sources.stream()
                        .filter(
                                source ->
                                        source.alignmentStatus()
                                                != AlignmentStatus.UNALIGNED
                        )
                        .count();

        BigDecimal strategicValueTotal =
                sources.stream()
                        .map(
                                AlignmentSourceResponse::
                                        strategicValue
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal strategicValueAligned =
                sources.stream()
                        .filter(
                                source ->
                                        source.alignmentStatus()
                                                != AlignmentStatus.UNALIGNED
                        )
                        .map(
                                AlignmentSourceResponse::
                                        strategicValue
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal riskTotal =
                sources.stream()
                        .map(
                                AlignmentSourceResponse::
                                        riskExposure
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal riskAligned =
                sources.stream()
                        .filter(
                                source ->
                                        source.alignmentStatus()
                                                != AlignmentStatus.UNALIGNED
                        )
                        .map(
                                AlignmentSourceResponse::
                                        riskExposure
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        StrategicAlignmentSummaryResponse summary =
                new StrategicAlignmentSummaryResponse(
                        objectives.size(),
                        objectivesWithAlignment,
                        sources.size(),
                        alignedCount,
                        sources.size()
                                - alignedCount,
                        (
                                int
                        ) sources.stream()
                                .filter(
                                        source ->
                                                source.alignmentStatus()
                                                        == AlignmentStatus.FULL
                                )
                                .count(),
                        (
                                int
                        ) sources.stream()
                                .filter(
                                        source ->
                                                source.alignmentStatus()
                                                        == AlignmentStatus.PARTIAL
                                )
                                .count(),
                        (
                                int
                        ) sources.stream()
                                .filter(
                                        AlignmentSourceResponse::
                                                splitCommitment
                                )
                                .count(),
                        sources.stream()
                                .mapToInt(
                                        AlignmentSourceResponse::
                                                deadlineConflictCount
                                )
                                .sum(),
                        money(
                                strategicValueTotal
                        ),
                        money(
                                strategicValueAligned
                        ),
                        money(
                                riskTotal
                        ),
                        money(
                                riskAligned
                        ),
                        score.sourceCoveragePct(),
                        score.objectiveCoveragePct(),
                        score.valueCoveragePct(),
                        score.riskCoveragePct(),
                        score.scheduleAlignmentPct(),
                        score.alignmentScore(),
                        score.health()
                );

        return new LiveAlignment(
                summary,
                objectiveResponses,
                sources
        );
    }

    private AlignmentSourceResponse sourceResponse(
            AlignmentPortfolioItem source
    ) {
        List<StrategicAlignmentRepository.LinkRow> links =
                repository
                        .linksForSource(
                                source.sourceType(),
                                source.sourceEntityId()
                        );

        BigDecimal allocation =
                links.stream()
                        .map(
                                StrategicAlignmentRepository.LinkRow::
                                        allocationPct
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        int deadlineConflicts =
                repository
                        .deadlineConflictCount(
                                source.sourceType(),
                                source.sourceEntityId(),
                                source.dueDate()
                        );

        return new AlignmentSourceResponse(
                source.sourceType(),
                source.sourceEntityId(),
                source.sourceReference(),
                source.sourceTitle(),
                source.sourceStatus(),
                money(
                        source.strategicValue()
                ),
                money(
                        source.riskExposure()
                ),
                decimal(
                        source.riskScore()
                ),
                source.dueDate(),
                allocation,
                links.size(),
                repository
                        .okrContributionCount(
                                source.sourceType(),
                                source.sourceEntityId()
                        ),
                scoringService
                        .status(
                                allocation
                        ),
                links.size() > 1,
                deadlineConflicts
        );
    }

    private ObjectiveAlignmentSummaryResponse objectiveSummary(
            StrategicAlignmentRepository.ObjectiveRow objective,
            List<AlignmentPortfolioItem> portfolio
    ) {
        List<StrategicAlignmentRepository.LinkRow> links =
                repository
                        .linksForObjective(
                                objective.id()
                        );

        BigDecimal alignedValue =
                BigDecimal.ZERO;

        BigDecimal coveredRisk =
                BigDecimal.ZERO;

        int conflicts =
                0;

        for (
                StrategicAlignmentRepository.LinkRow link
                : links
        ) {
            AlignmentPortfolioItem source =
                    portfolio.stream()
                            .filter(
                                    candidate ->
                                            candidate.sourceType()
                                                    == link.sourceType()
                                            &&
                                            candidate.sourceEntityId()
                                                    .equals(
                                                            link.sourceEntityId()
                                                    )
                            )
                            .findFirst()
                            .orElse(null);

            if (source == null) {
                continue;
            }

            BigDecimal allocationRatio =
                    decimal(
                            link.allocationPct()
                    )
                            .divide(
                                    new BigDecimal(
                                            "100.00"
                                    ),
                                    6,
                                    RoundingMode.HALF_UP
                            );

            alignedValue =
                    alignedValue.add(
                            money(
                                    source.strategicValue()
                            )
                                    .multiply(
                                            allocationRatio
                                    )
                    );

            coveredRisk =
                    coveredRisk.add(
                            money(
                                    source.riskExposure()
                            )
                                    .multiply(
                                            allocationRatio
                                    )
                    );

            if (
                    source.dueDate()
                            != null
                    &&
                    source.dueDate()
                            .isAfter(
                                    objective.endDate()
                            )
            ) {
                conflicts++;
            }
        }

        ObjectiveOkrScore okr =
                objectiveOkrScore(
                        objective.id()
                );

        return new ObjectiveAlignmentSummaryResponse(
                objective.id(),
                objective.objectiveNumber(),
                objective.title(),
                objective.status(),
                objective.endDate(),
                objective.ownerName(),
                okr.progress(),
                okr.health(),
                links.size(),
                money(
                        alignedValue
                ),
                money(
                        coveredRisk
                ),
                conflicts
        );
    }

    private ObjectiveOkrScore objectiveOkrScore(
            UUID objectiveId
    ) {
        List<StrategicAlignmentRepository.KeyResultMetricRow> rows =
                repository
                        .objectiveKeyResults(
                                objectiveId
                        );

        if (rows.isEmpty()) {
            return new ObjectiveOkrScore(
                    BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            ),
                    StrategicHealth.OFF_TRACK
            );
        }

        BigDecimal weightedProgress =
                okrMathService
                        .weightedScore(
                                rows.stream()
                                        .map(
                                                row ->
                                                        new StrategicOkrMathService.WeightedValue(
                                                                okrMathService.progress(
                                                                        row.direction(),
                                                                        row.baselineValue(),
                                                                        row.targetValue(),
                                                                        row.actualValue()
                                                                ),
                                                                row.weightPct()
                                                        )
                                        )
                                        .toList()
                        );

        return new ObjectiveOkrScore(
                weightedProgress,
                okrMathService.health(
                        weightedProgress
                )
        );
    }

    private String objectiveCurrency(
            UUID objectiveId
    ) {
        return requireObjective(
                objectiveId
        )
                .currency();
    }

    private AlignmentLinkResponse linkResponse(
            StrategicAlignmentRepository.LinkRow row
    ) {
        return new AlignmentLinkResponse(
                row.id(),
                row.objectiveId(),
                row.objectiveNumber(),
                row.objectiveTitle(),
                row.sourceType(),
                row.sourceEntityId(),
                row.sourceReference(),
                row.sourceTitle(),
                row.alignmentRole(),
                decimal(
                        row.allocationPct()
                ),
                row.rationale(),
                row.createdByName(),
                row.createdAt()
        );
    }

    private AlignmentReviewSummaryResponse reviewSummary(
            StrategicAlignmentRepository.ReviewRow row
    ) {
        return new AlignmentReviewSummaryResponse(
                row.id(),
                row.reviewNumber(),
                row.currency(),
                row.fiscalYear(),
                decimal(
                        row.alignmentScore()
                ),
                row.alignmentHealth(),
                row.alignedSourceCount(),
                row.unalignedSourceCount(),
                row.deadlineConflictCount(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private StrategicAlignmentSummaryResponse summaryFromReview(
            StrategicAlignmentRepository.ReviewRow row
    ) {
        return new StrategicAlignmentSummaryResponse(
                row.objectiveCount(),
                row.objectivesWithAlignment(),
                row.candidateSourceCount(),
                row.alignedSourceCount(),
                row.unalignedSourceCount(),
                row.fullyAlignedSourceCount(),
                row.partiallyAlignedSourceCount(),
                row.splitCommitmentCount(),
                row.deadlineConflictCount(),
                money(
                        row.strategicValueTotal()
                ),
                money(
                        row.strategicValueAligned()
                ),
                money(
                        row.riskExposureTotal()
                ),
                money(
                        row.riskExposureAligned()
                ),
                decimal(
                        row.sourceCoveragePct()
                ),
                decimal(
                        row.objectiveCoveragePct()
                ),
                decimal(
                        row.valueCoveragePct()
                ),
                decimal(
                        row.riskCoveragePct()
                ),
                decimal(
                        row.scheduleAlignmentPct()
                ),
                decimal(
                        row.alignmentScore()
                ),
                row.alignmentHealth()
        );
    }

    private AlignmentSourceResponse reviewItemResponse(
            StrategicAlignmentRepository.ReviewItemRow row
    ) {
        return new AlignmentSourceResponse(
                row.sourceType(),
                row.sourceEntityId(),
                row.sourceReference(),
                row.sourceTitle(),
                row.sourceStatus(),
                money(
                        row.strategicValue()
                ),
                money(
                        row.riskExposure()
                ),
                decimal(
                        row.riskScore()
                ),
                row.dueDate(),
                decimal(
                        row.directAllocationPct()
                ),
                row.linkedObjectiveCount(),
                row.okrContributionCount(),
                row.alignmentStatus(),
                row.splitCommitment(),
                row.deadlineConflictCount()
        );
    }

    private StrategicAlignmentRepository.ObjectiveRow requireObjective(
            UUID objectiveId
    ) {
        StrategicAlignmentRepository.ObjectiveRow objective =
                repository
                        .findObjective(
                                objectiveId
                        );

        if (objective == null) {
            throw new ResourceNotFoundException(
                    "Strategic objective not found: "
                            + objectiveId
            );
        }

        return objective;
    }

    private String nextReviewNumber() {
        return String.format(
                "ALIGN-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextReviewSequence()
        );
    }

    private AppUserEntity findCurrentUser(
            UUID userId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(
                                userId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Authenticated ProcureIQ user not found."
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "Authenticated ProcureIQ account is inactive."
            );
        }

        return user;
    }

    private String normalizeCurrency(
            String currency
    ) {
        if (
                currency == null
                ||
                currency.trim()
                        .length()
                        != 3
        ) {
            throw new IllegalArgumentException(
                    "Strategic-alignment currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private BigDecimal decimal(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        return decimal(
                value
        );
    }

    private void assertReadRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
                &&
                role != ProcurementRole.APPROVER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot access strategic alignment."
            );
        }
    }

    private void assertWriteRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot manage strategic alignment."
            );
        }
    }

    private record ObjectiveOkrScore(
            BigDecimal progress,
            StrategicHealth health
    ) {
    }

    private record LiveAlignment(
            StrategicAlignmentSummaryResponse summary,
            List<ObjectiveAlignmentSummaryResponse> objectives,
            List<AlignmentSourceResponse> sources
    ) {
    }
}
