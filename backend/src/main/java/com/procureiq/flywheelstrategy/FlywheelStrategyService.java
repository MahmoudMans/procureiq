package com.procureiq.flywheelstrategy;

import com.procureiq.capitalflywheel.CapitalFlywheelCycleResponse;
import com.procureiq.capitalflywheel.CapitalFlywheelDashboardResponse;
import com.procureiq.capitalflywheel.CapitalFlywheelLineageDetailResponse;
import com.procureiq.capitalflywheel.CapitalFlywheelLineageResponse;
import com.procureiq.capitalflywheel.CapitalFlywheelService;
import com.procureiq.capitalflywheel.CapitalFlywheelStatus;
import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class FlywheelStrategyService {

    private final FlywheelStrategyRepository repository;
    private final FlywheelStrategyMathService mathService;
    private final CapitalFlywheelService capitalFlywheelService;
    private final AppUserRepository appUserRepository;

    public FlywheelStrategyService(
            FlywheelStrategyRepository repository,
            FlywheelStrategyMathService mathService,
            CapitalFlywheelService capitalFlywheelService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.capitalFlywheelService =
                capitalFlywheelService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public FlywheelStrategyDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        List<FlywheelStrategyCandidateResponse> candidates =
                strategyCandidates(
                        currentUserId
                );

        List<FlywheelStrategyPortfolioResponse> portfolios =
                repository
                        .portfolios()
                        .stream()
                        .map(
                                this::portfolioResponse
                        )
                        .toList();

        return new FlywheelStrategyDashboardResponse(
                summary(
                        candidates.size(),
                        portfolios
                ),

                repository.users(),

                candidates,

                portfolios,

                repository
                        .snapshots()
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public FlywheelStrategyPortfolioDetailResponse createPortfolio(
            UUID currentUserId,
            FlywheelStrategyPortfolioInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        AppUserEntity owner =
                requireStrategyUser(
                        input.portfolioOwnerUserId()
                );

        UUID portfolioId =
                UUID.randomUUID();

        repository.createPortfolio(
                portfolioId,
                nextPortfolioNumber(),
                input,
                owner.getFullName(),
                currentUserId
        );

        return portfolio(
                currentUserId,
                portfolioId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelStrategyPortfolioDetailResponse portfolio(
            UUID currentUserId,
            UUID portfolioId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelStrategyRepository.PortfolioRow portfolio =
                requirePortfolio(
                        portfolioId
                );

        List<FlywheelStrategyCandidateResponse> candidates =
                strategyCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                candidate ->
                                        candidate
                                                .currency()
                                                .equalsIgnoreCase(
                                                        portfolio.currency()
                                                )
                        )
                        .filter(
                                candidate ->
                                        candidate.rootFiscalYear()
                                                <= portfolio.fiscalYear()
                        )
                        .toList();

        return new FlywheelStrategyPortfolioDetailResponse(
                portfolioResponse(
                        portfolio
                ),

                repository.users(),

                candidates,

                repository
                        .items(
                                portfolioId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList(),

                repository
                        .snapshotsForPortfolio(
                                portfolioId
                        )
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public FlywheelStrategyPortfolioDetailResponse addItem(
            UUID currentUserId,
            UUID portfolioId,
            FlywheelStrategyItemInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelStrategyRepository.PortfolioRow portfolio =
                requirePortfolio(
                        portfolioId
                );

        if (
                portfolio.status()
                        != FlywheelStrategyPortfolioStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Flywheel lineages can be added only while the strategy portfolio is DRAFT."
            );
        }

        if (
                repository.lineageInOpenPortfolio(
                        input.flywheelLineageId()
                )
        ) {
            throw new IllegalArgumentException(
                    "Flywheel lineage already belongs to an active strategy portfolio."
            );
        }

        FlywheelStrategyCandidateResponse candidate =
                strategyCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                source ->
                                        source
                                                .flywheelLineageId()
                                                .equals(
                                                        input.flywheelLineageId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Step 66 lineage is not currently eligible for portfolio rebalancing."
                                        )
                        );

        if (
                !candidate
                        .currency()
                        .equalsIgnoreCase(
                                portfolio.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Flywheel lineage currency must match the strategy portfolio currency."
            );
        }

        if (
                candidate.rootFiscalYear()
                        > portfolio.fiscalYear()
        ) {
            throw new IllegalArgumentException(
                    "Flywheel lineage root fiscal year cannot exceed the portfolio planning year."
            );
        }

        BigDecimal proposed =
                mathService.money(
                        input.proposedCapacityAmount()
                );

        if (
                proposed.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "Proposed capacity must be positive."
            );
        }

        if (
                proposed.compareTo(
                        mathService.money(
                                candidate.referenceNextCycleCapitalAmount()
                        )
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Proposed capacity cannot exceed the latest governed Step 66 cycle-capital reference."
            );
        }

        if (
                proposed.compareTo(
                        mathService.money(
                                portfolio.capitalCapacityAmount()
                        )
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "A single proposed lineage capacity cannot exceed the portfolio capital-capacity envelope."
            );
        }

        validateCandidateAuthority(
                currentUserId,
                candidate
        );

        repository.createItem(
                UUID.randomUUID(),
                portfolioId,
                candidate,
                proposed,
                currentUserId
        );

        return portfolio(
                currentUserId,
                portfolioId
        );
    }

    public FlywheelStrategyPortfolioDetailResponse submitForReview(
            UUID currentUserId,
            UUID portfolioId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelStrategyRepository.PortfolioRow portfolio =
                requirePortfolio(
                        portfolioId
                );

        if (
                portfolio.status()
                        != FlywheelStrategyPortfolioStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only a DRAFT flywheel strategy portfolio can enter review."
            );
        }

        List<FlywheelStrategyRepository.ItemRow> items =
                repository.items(
                        portfolioId
                );

        if (
                items.size()
                        < 2
        ) {
            throw new IllegalArgumentException(
                    "Portfolio rebalancing requires at least two competing flywheel lineages."
            );
        }

        for (
                FlywheelStrategyRepository.ItemRow item
                : items
        ) {
            validateItemAuthority(
                    currentUserId,
                    portfolio,
                    item
            );
        }

        int updated =
                repository.markInReview(
                        portfolioId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Flywheel strategy portfolio state changed before review submission."
            );
        }

        return portfolio(
                currentUserId,
                portfolioId
        );
    }

    public FlywheelStrategyPortfolioDetailResponse decideItem(
            UUID currentUserId,
            UUID itemId,
            FlywheelStrategyDecisionInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        if (
                input.decision()
                        == FlywheelStrategyDecision.PENDING
        ) {
            throw new IllegalArgumentException(
                    "A final portfolio decision must be PRIORITIZE, HOLD or EXIT."
            );
        }

        FlywheelStrategyRepository.ItemRow item =
                requireItem(
                        itemId
                );

        FlywheelStrategyRepository.PortfolioRow portfolio =
                requirePortfolio(
                        item.portfolioId()
                );

        if (
                portfolio.status()
                        != FlywheelStrategyPortfolioStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Flywheel decisions can be recorded only while the portfolio is IN_REVIEW."
            );
        }

        if (
                item.decision()
                        != FlywheelStrategyDecision.PENDING
        ) {
            throw new IllegalArgumentException(
                    "Flywheel portfolio item already has a final governance decision."
            );
        }

        validateItemAuthority(
                currentUserId,
                portfolio,
                item
        );

        if (
                input.decision()
                        == FlywheelStrategyDecision.PRIORITIZE
        ) {
            BigDecimal alreadyPrioritized =
                    repository
                            .items(
                                    portfolio.id()
                            )
                            .stream()
                            .filter(
                                    current ->
                                            current.decision()
                                                    == FlywheelStrategyDecision.PRIORITIZE
                            )
                            .map(
                                    FlywheelStrategyRepository.ItemRow::
                                            proposedCapacityAmount
                            )
                            .map(
                                    mathService::money
                            )
                            .reduce(
                                    BigDecimal.ZERO,
                                    BigDecimal::add
                            );

            BigDecimal resulting =
                    alreadyPrioritized.add(
                            mathService.money(
                                    item.proposedCapacityAmount()
                            )
                    );

            if (
                    resulting.compareTo(
                            mathService.money(
                                    portfolio.capitalCapacityAmount()
                            )
                    ) > 0
            ) {
                throw new IllegalArgumentException(
                        "PRIORITIZE decision would exceed the governed portfolio capital-capacity envelope."
                );
            }
        }

        int updated =
                repository.decideItem(
                        itemId,
                        input,
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Flywheel portfolio decision state changed before persistence."
            );
        }

        return portfolio(
                currentUserId,
                portfolio.id()
        );
    }

    public FlywheelStrategyPortfolioDetailResponse approvePortfolio(
            UUID currentUserId,
            UUID portfolioId,
            FlywheelStrategyNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelStrategyRepository.PortfolioRow portfolio =
                requirePortfolio(
                        portfolioId
                );

        if (
                portfolio.status()
                        != FlywheelStrategyPortfolioStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only an IN_REVIEW strategy portfolio can be approved."
            );
        }

        List<FlywheelStrategyRepository.ItemRow> items =
                repository.items(
                        portfolioId
                );

        if (items.isEmpty()) {
            throw new IllegalArgumentException(
                    "Flywheel strategy portfolio has no lineages."
            );
        }

        if (
                items.stream()
                        .anyMatch(
                                item ->
                                        item.decision()
                                                == FlywheelStrategyDecision.PENDING
                        )
        ) {
            throw new IllegalArgumentException(
                    "All flywheel lineages require an explicit PRIORITIZE, HOLD or EXIT decision before approval."
            );
        }

        if (
                items.stream()
                        .noneMatch(
                                item ->
                                        item.decision()
                                                == FlywheelStrategyDecision.PRIORITIZE
                        )
        ) {
            throw new IllegalArgumentException(
                    "Portfolio approval requires at least one prioritized flywheel lineage."
            );
        }

        for (
                FlywheelStrategyRepository.ItemRow item
                : items
        ) {
            if (
                    item.decision()
                            == FlywheelStrategyDecision.PRIORITIZE
            ) {
                validateItemAuthority(
                        currentUserId,
                        portfolio,
                        item
                );
            }
        }

        FlywheelStrategyPortfolioMetricResult metric =
                portfolioMetric(
                        portfolio,
                        items
                );

        if (
                metric
                        .prioritizedCapacityAmount()
                        .compareTo(
                                mathService.money(
                                        portfolio.capitalCapacityAmount()
                                )
                        ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Prioritized capacity exceeds the governed portfolio envelope."
            );
        }

        int updated =
                repository.approvePortfolio(
                        portfolioId,
                        input.note(),
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Flywheel strategy portfolio state changed before approval."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                portfolioId
        );

        return portfolio(
                currentUserId,
                portfolioId
        );
    }

    public FlywheelStrategyPortfolioDetailResponse closePortfolio(
            UUID currentUserId,
            UUID portfolioId,
            FlywheelStrategyNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelStrategyRepository.PortfolioRow portfolio =
                requirePortfolio(
                        portfolioId
                );

        if (
                portfolio.status()
                        != FlywheelStrategyPortfolioStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Only an APPROVED flywheel strategy portfolio can be closed."
            );
        }

        int updated =
                repository.closePortfolio(
                        portfolioId,
                        input.note(),
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Flywheel strategy portfolio state changed before closure."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                portfolioId
        );

        return portfolio(
                currentUserId,
                portfolioId
        );
    }

    public FlywheelStrategySnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            UUID portfolioId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        requirePortfolio(
                portfolioId
        );

        return captureSnapshotInternal(
                currentUserId,
                portfolioId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelStrategySnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelStrategyRepository.SnapshotRow snapshot =
                repository.findSnapshot(
                        snapshotId
                );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Flywheel-strategy snapshot not found: "
                            + snapshotId
            );
        }

        return new FlywheelStrategySnapshotDetailResponse(
                snapshotSummary(
                        snapshot
                ),

                repository
                        .snapshotItems(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::snapshotItemResponse
                        )
                        .toList()
        );
    }

    private FlywheelStrategySnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId,
            UUID portfolioId
    ) {
        FlywheelStrategyRepository.PortfolioRow portfolio =
                requirePortfolio(
                        portfolioId
                );

        FlywheelStrategyPortfolioResponse response =
                portfolioResponse(
                        portfolio
                );

        List<FlywheelStrategyItemResponse> items =
                repository
                        .items(
                                portfolioId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                response,
                currentUserId
        );

        for (
                FlywheelStrategyItemResponse item
                : items
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    item
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<FlywheelStrategyCandidateResponse> strategyCandidates(
            UUID currentUserId
    ) {
        CapitalFlywheelDashboardResponse dashboard =
                capitalFlywheelService.dashboard(
                        currentUserId
                );

        return dashboard
                .lineages()
                .stream()
                .filter(
                        lineage ->
                                lineage.status()
                                        == CapitalFlywheelStatus.APPROVED_FOR_NEXT_CYCLE
                )
                .filter(
                        lineage ->
                                !repository.lineageInOpenPortfolio(
                                        lineage.id()
                                )
                )
                .map(
                        lineage ->
                                candidateResponse(
                                        currentUserId,
                                        lineage
                                )
                )
                .toList();
    }

    private FlywheelStrategyCandidateResponse candidateResponse(
            UUID currentUserId,
            CapitalFlywheelLineageResponse lineage
    ) {
        CapitalFlywheelLineageDetailResponse detail =
                capitalFlywheelService.lineage(
                        currentUserId,
                        lineage.id()
                );

        List<CapitalFlywheelCycleResponse> cycles =
                detail.cycles();

        if (cycles.isEmpty()) {
            throw new IllegalArgumentException(
                    "Approved Step 66 lineage contains no cycle evidence."
            );
        }

        CapitalFlywheelCycleResponse latest =
                cycles.get(
                        cycles.size() - 1
                );

        FlywheelStrategyPriorityResult priority =
                mathService.priority(
                        new FlywheelStrategyPriorityInput(
                                lineage.cumulativeValueMultiple(),
                                lineage.latestMarginalValueMultiple(),
                                lineage.latestMarginalNetValueRetentionPct(),
                                lineage.diminishingReturns(),
                                lineage.flywheelHealth(),
                                lineage.recommendation()
                        )
                );

        return new FlywheelStrategyCandidateResponse(
                lineage.id(),
                lineage.lineageNumber(),

                lineage.status(),

                lineage.rootTargetValueCaseId(),
                lineage.rootTargetValueCaseNumber(),
                lineage.rootTargetInitiativeTitle(),

                lineage.currency(),
                lineage.rootFiscalYear(),

                lineage.cycleCount(),

                mathService.money(
                        lineage.originalCapitalAmount()
                ),

                mathService.money(
                        latest.redeployedCapitalAmount()
                ),

                mathService.money(
                        lineage.cumulativeProjectedNetValueAmount()
                ),

                mathService.money(
                        lineage.cumulativeCompoundingValueAmount()
                ),

                mathService.money(
                        lineage.cumulativeDecayedValueAmount()
                ),

                mathService.decimal(
                        lineage.cumulativeValueMultiple()
                ),

                mathService.decimal(
                        lineage.latestMarginalValueMultiple()
                ),

                mathService.percent(
                        lineage.latestMarginalNetValueRetentionPct()
                ),

                lineage.diminishingReturns(),

                lineage.flywheelHealth(),
                lineage.recommendation(),

                priority.priorityScore(),
                priority.advisoryRecommendation()
        );
    }

    private FlywheelStrategyPortfolioResponse portfolioResponse(
            FlywheelStrategyRepository.PortfolioRow row
    ) {
        List<FlywheelStrategyRepository.ItemRow> items =
                repository.items(
                        row.id()
                );

        FlywheelStrategyPortfolioMetricResult metric =
                portfolioMetric(
                        row,
                        items
                );

        return new FlywheelStrategyPortfolioResponse(
                row.id(),
                row.portfolioNumber(),
                row.title(),

                row.currency(),
                row.fiscalYear(),

                mathService.money(
                        row.capitalCapacityAmount()
                ),

                metric.prioritizedCapacityAmount(),
                metric.remainingCapacityAmount(),
                metric.capacityUtilizationPct(),
                metric.averagePriorityScore(),

                row.portfolioOwnerUserId(),
                row.portfolioOwnerName(),
                row.strategicObjective(),

                row.status(),

                items.size(),

                countDecision(
                        items,
                        FlywheelStrategyDecision.PRIORITIZE
                ),

                countDecision(
                        items,
                        FlywheelStrategyDecision.HOLD
                ),

                countDecision(
                        items,
                        FlywheelStrategyDecision.EXIT
                ),

                countDecision(
                        items,
                        FlywheelStrategyDecision.PENDING
                ),

                row.approvalNote(),
                row.approvedByName(),
                row.approvedAt(),

                row.closeNote(),
                row.closedByName(),
                row.closedAt(),

                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private FlywheelStrategyPortfolioMetricResult portfolioMetric(
            FlywheelStrategyRepository.PortfolioRow portfolio,
            List<FlywheelStrategyRepository.ItemRow> items
    ) {
        return mathService.portfolio(
                portfolio.capitalCapacityAmount(),

                items.stream()
                        .filter(
                                item ->
                                        item.decision()
                                                == FlywheelStrategyDecision.PRIORITIZE
                        )
                        .map(
                                FlywheelStrategyRepository.ItemRow::
                                        proposedCapacityAmount
                        )
                        .toList(),

                items.stream()
                        .map(
                                FlywheelStrategyRepository.ItemRow::
                                        priorityScore
                        )
                        .toList()
        );
    }

    private FlywheelStrategyItemResponse itemResponse(
            FlywheelStrategyRepository.ItemRow row
    ) {
        return new FlywheelStrategyItemResponse(
                row.id(),
                row.portfolioId(),

                row.flywheelLineageId(),
                row.lineageNumber(),

                row.rootTargetValueCaseId(),
                row.rootTargetValueCaseNumber(),
                row.rootTargetInitiativeTitle(),

                row.lineageRootFiscalYear(),
                row.lineageCycleCount(),

                mathService.money(
                        row.lineageOriginalCapitalAmount()
                ),

                mathService.money(
                        row.referenceNextCycleCapitalAmount()
                ),

                mathService.money(
                        row.proposedCapacityAmount()
                ),

                mathService.money(
                        row.cumulativeProjectedNetValueAmount()
                ),

                mathService.money(
                        row.cumulativeCompoundingValueAmount()
                ),

                mathService.money(
                        row.cumulativeDecayedValueAmount()
                ),

                mathService.decimal(
                        row.cumulativeValueMultiple()
                ),

                mathService.decimal(
                        row.latestMarginalValueMultiple()
                ),

                mathService.percent(
                        row.latestMarginalNetValueRetentionPct()
                ),

                row.diminishingReturns(),

                row.flywheelHealth(),
                row.step66Recommendation(),

                mathService.percent(
                        row.priorityScore()
                ),

                row.advisoryRecommendation(),

                row.decision(),

                row.decisionNote(),
                row.decidedByName(),
                row.decidedAt(),

                row.addedByName(),
                row.addedAt()
        );
    }

    private void validateCandidateAuthority(
            UUID currentUserId,
            FlywheelStrategyCandidateResponse candidate
    ) {
        CapitalFlywheelLineageResponse current =
                capitalFlywheelService
                        .lineage(
                                currentUserId,
                                candidate.flywheelLineageId()
                        )
                        .lineage();

        if (
                current.status()
                        != CapitalFlywheelStatus.APPROVED_FOR_NEXT_CYCLE
        ) {
            throw new IllegalArgumentException(
                    "Step 66 lineage no longer has approved next-cycle authority."
            );
        }

        if (
                mathService
                        .decimal(
                                current.cumulativeValueMultiple()
                        )
                        .compareTo(
                                mathService.decimal(
                                        candidate.cumulativeValueMultiple()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 66 cumulative value multiple changed before portfolio capture."
            );
        }

        if (
                mathService
                        .decimal(
                                current.latestMarginalValueMultiple()
                        )
                        .compareTo(
                                mathService.decimal(
                                        candidate.latestMarginalValueMultiple()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 66 marginal value multiple changed before portfolio capture."
            );
        }
    }

    private void validateItemAuthority(
            UUID currentUserId,
            FlywheelStrategyRepository.PortfolioRow portfolio,
            FlywheelStrategyRepository.ItemRow item
    ) {
        CapitalFlywheelLineageDetailResponse detail =
                capitalFlywheelService.lineage(
                        currentUserId,
                        item.flywheelLineageId()
                );

        CapitalFlywheelLineageResponse lineage =
                detail.lineage();

        if (
                lineage.status()
                        != CapitalFlywheelStatus.APPROVED_FOR_NEXT_CYCLE
        ) {
            throw new IllegalArgumentException(
                    "A portfolio lineage no longer has approved Step 66 next-cycle authority."
            );
        }

        if (
                !lineage
                        .currency()
                        .equalsIgnoreCase(
                                portfolio.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "A portfolio lineage no longer matches the portfolio currency."
            );
        }

        if (
                mathService
                        .decimal(
                                lineage.cumulativeValueMultiple()
                        )
                        .compareTo(
                                mathService.decimal(
                                        item.cumulativeValueMultiple()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Current Step 66 cumulative value multiple no longer matches the frozen portfolio item."
            );
        }

        if (
                mathService
                        .decimal(
                                lineage.latestMarginalValueMultiple()
                        )
                        .compareTo(
                                mathService.decimal(
                                        item.latestMarginalValueMultiple()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Current Step 66 marginal value multiple no longer matches the frozen portfolio item."
            );
        }

        if (detail.cycles().isEmpty()) {
            throw new IllegalArgumentException(
                    "Current Step 66 lineage contains no cycle evidence."
            );
        }

        CapitalFlywheelCycleResponse latest =
                detail
                        .cycles()
                        .get(
                                detail.cycles().size() - 1
                        );

        if (
                mathService
                        .money(
                                latest.redeployedCapitalAmount()
                        )
                        .compareTo(
                                mathService.money(
                                        item.referenceNextCycleCapitalAmount()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Latest Step 66 cycle capital no longer matches the frozen portfolio reference."
            );
        }
    }

    private FlywheelStrategySummaryResponse summary(
            int candidateCount,
            List<FlywheelStrategyPortfolioResponse> portfolios
    ) {
        return new FlywheelStrategySummaryResponse(
                candidateCount,
                portfolios.size(),

                countStatus(
                        portfolios,
                        FlywheelStrategyPortfolioStatus.DRAFT
                ),

                countStatus(
                        portfolios,
                        FlywheelStrategyPortfolioStatus.IN_REVIEW
                ),

                countStatus(
                        portfolios,
                        FlywheelStrategyPortfolioStatus.APPROVED
                ),

                countStatus(
                        portfolios,
                        FlywheelStrategyPortfolioStatus.CLOSED
                ),

                portfolios.stream()
                        .mapToInt(
                                FlywheelStrategyPortfolioResponse::
                                        prioritizeCount
                        )
                        .sum(),

                portfolios.stream()
                        .mapToInt(
                                FlywheelStrategyPortfolioResponse::
                                        holdCount
                        )
                        .sum(),

                portfolios.stream()
                        .mapToInt(
                                FlywheelStrategyPortfolioResponse::
                                        exitCount
                        )
                        .sum()
        );
    }

    private FlywheelStrategySnapshotSummaryResponse snapshotSummary(
            FlywheelStrategyRepository.SnapshotRow row
    ) {
        return new FlywheelStrategySnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),

                row.portfolioId(),
                row.portfolioNumber(),

                row.currency(),
                row.fiscalYear(),

                row.portfolioStatus(),

                mathService.money(
                        row.capitalCapacityAmount()
                ),

                row.itemCount(),
                row.prioritizeCount(),
                row.holdCount(),
                row.exitCount(),
                row.pendingCount(),

                mathService.money(
                        row.prioritizedCapacityAmount()
                ),

                mathService.money(
                        row.remainingCapacityAmount()
                ),

                mathService.percent(
                        row.capacityUtilizationPct()
                ),

                mathService.percent(
                        row.averagePriorityScore()
                ),

                row.capturedByName(),
                row.capturedAt()
        );
    }

    private FlywheelStrategySnapshotItemResponse snapshotItemResponse(
            FlywheelStrategyRepository.SnapshotItemRow row
    ) {
        return new FlywheelStrategySnapshotItemResponse(
                row.flywheelLineageId(),
                row.lineageNumber(),
                row.rootTargetInitiativeTitle(),

                mathService.money(
                        row.proposedCapacityAmount()
                ),

                mathService.money(
                        row.cumulativeProjectedNetValueAmount()
                ),

                mathService.decimal(
                        row.cumulativeValueMultiple()
                ),

                mathService.decimal(
                        row.latestMarginalValueMultiple()
                ),

                mathService.percent(
                        row.latestMarginalNetValueRetentionPct()
                ),

                row.diminishingReturns(),

                row.flywheelHealth(),
                row.step66Recommendation(),

                mathService.percent(
                        row.priorityScore()
                ),

                row.advisoryRecommendation(),

                row.decision(),
                row.decisionNote()
        );
    }

    private FlywheelStrategyRepository.PortfolioRow requirePortfolio(
            UUID portfolioId
    ) {
        FlywheelStrategyRepository.PortfolioRow portfolio =
                repository.findPortfolio(
                        portfolioId
                );

        if (portfolio == null) {
            throw new ResourceNotFoundException(
                    "Flywheel strategy portfolio not found: "
                            + portfolioId
            );
        }

        return portfolio;
    }

    private FlywheelStrategyRepository.ItemRow requireItem(
            UUID itemId
    ) {
        FlywheelStrategyRepository.ItemRow item =
                repository.findItem(
                        itemId
                );

        if (item == null) {
            throw new ResourceNotFoundException(
                    "Flywheel strategy item not found: "
                            + itemId
            );
        }

        return item;
    }

    private AppUserEntity requireStrategyUser(
            UUID userId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        userId
                );

        if (
                user.getRole()
                        == ProcurementRole.REQUESTER
        ) {
            throw new IllegalArgumentException(
                    "Requester accounts cannot own flywheel strategy portfolios."
            );
        }

        return user;
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
                                                "ProcureIQ user not found: "
                                                        + userId
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "ProcureIQ account is inactive."
            );
        }

        return user;
    }

    private int countDecision(
            List<FlywheelStrategyRepository.ItemRow> items,
            FlywheelStrategyDecision decision
    ) {
        return (int)
                items.stream()
                        .filter(
                                item ->
                                        item.decision()
                                                == decision
                        )
                        .count();
    }

    private int countStatus(
            List<FlywheelStrategyPortfolioResponse> portfolios,
            FlywheelStrategyPortfolioStatus status
    ) {
        return (int)
                portfolios.stream()
                        .filter(
                                portfolio ->
                                        portfolio.status()
                                                == status
                        )
                        .count();
    }

    private String nextPortfolioNumber() {
        return String.format(
                "FWSTRAT-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                ).getValue(),
                repository.nextPortfolioSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "FWSTRATSNAP-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                ).getValue(),
                repository.nextSnapshotSequence()
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
                    "Your ProcureIQ role cannot access flywheel strategy governance."
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
                    "Your ProcureIQ role cannot manage flywheel strategy planning."
            );
        }
    }

    private void assertFinalizeRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can make flywheel portfolio allocation decisions."
            );
        }
    }
}
