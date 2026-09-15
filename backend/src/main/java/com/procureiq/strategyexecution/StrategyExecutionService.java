package com.procureiq.strategyexecution;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.strategyroadmap.RoadmapInitiativeResponse;
import com.procureiq.strategyroadmap.StrategyRoadmapDetailResponse;
import com.procureiq.strategyroadmap.StrategyRoadmapService;
import com.procureiq.strategyroadmap.StrategyRoadmapStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class StrategyExecutionService {

    private final StrategyExecutionRepository repository;

    private final StrategyExecutionMathService mathService;

    private final StrategyRoadmapService strategyRoadmapService;

    private final AppUserRepository appUserRepository;

    public StrategyExecutionService(
            StrategyExecutionRepository repository,
            StrategyExecutionMathService mathService,
            StrategyRoadmapService strategyRoadmapService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.strategyRoadmapService =
                strategyRoadmapService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public StrategyExecutionDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<ExecutionCommitmentResponse> commitments =
                repository
                        .commitments()
                        .stream()
                        .map(
                                this::commitmentResponse
                        )
                        .toList();

        return new StrategyExecutionDashboardResponse(
                summary(
                        commitments
                ),
                commitments,
                repository
                        .reviews()
                        .stream()
                        .map(
                                this::reviewSummary
                        )
                        .toList()
        );
    }

    public StrategyExecutionDashboardResponse importRoadmap(
            UUID currentUserId,
            UUID roadmapId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapDetailResponse roadmap =
                strategyRoadmapService
                        .roadmap(
                                currentUserId,
                                roadmapId
                        );

        if (
                roadmap
                        .roadmap()
                        .status()
                        != StrategyRoadmapStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Only an ACTIVE Step 52 roadmap can be imported into strategic execution."
            );
        }

        if (
                roadmap
                        .initiatives()
                        .isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "Roadmap has no initiatives to import."
            );
        }

        for (
                RoadmapInitiativeResponse initiative
                : roadmap.initiatives()
        ) {
            if (
                    initiative.ownerUserId()
                            == null
            ) {
                throw new IllegalArgumentException(
                        "Roadmap initiative is missing an execution owner: "
                                + initiative.initiativeNumber()
                );
            }

            if (
                    repository
                            .findCommitmentBySourceInitiative(
                                    initiative.id()
                            )
                    != null
            ) {
                continue;
            }

            repository.createCommitment(
                    UUID.randomUUID(),
                    nextCommitmentNumber(),
                    roadmap
                            .roadmap()
                            .id(),
                    roadmap
                            .roadmap()
                            .roadmapNumber(),
                    roadmap
                            .roadmap()
                            .title(),
                    initiative.id(),
                    initiative.initiativeNumber(),
                    initiative.title(),
                    initiative.dimensionKey(),
                    initiative.ownerUserId(),
                    initiative.ownerName(),
                    roadmap
                            .roadmap()
                            .currency(),
                    roadmap
                            .roadmap()
                            .fiscalYear(),
                    initiative.plannedStartDate(),
                    initiative.plannedEndDate(),
                    initiative.plannedContributionPoints(),
                    currentUserId
            );
        }

        return dashboard(
                currentUserId
        );
    }

    @Transactional(readOnly = true)
    public ExecutionCommitmentDetailResponse commitment(
            UUID currentUserId,
            UUID commitmentId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        commitmentId
                );

        return new ExecutionCommitmentDetailResponse(
                commitmentResponse(
                        commitment
                ),
                repository
                        .progressHistory(
                                commitmentId
                        )
                        .stream()
                        .map(
                                this::progressResponse
                        )
                        .toList(),
                repository
                        .outcomes(
                                commitmentId
                        )
                        .stream()
                        .map(
                                this::outcomeResponse
                        )
                        .toList()
        );
    }

    public ExecutionCommitmentDetailResponse startCommitment(
            UUID currentUserId,
            UUID commitmentId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        commitmentId
                );

        if (
                commitment.status()
                        != ExecutionCommitmentStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned execution commitments can be started."
            );
        }

        repository.startCommitment(
                commitmentId
        );

        return commitment(
                currentUserId,
                commitmentId
        );
    }

    public ExecutionCommitmentDetailResponse recordProgress(
            UUID currentUserId,
            UUID commitmentId,
            ExecutionProgressInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        commitmentId
                );

        if (
                commitment.status()
                        != ExecutionCommitmentStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Progress updates require an in-progress execution commitment."
            );
        }

        if (
                input.forecastEndDate()
                        .isBefore(
                                commitment.plannedStartDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Forecast end date cannot precede the planned start date."
            );
        }

        StrategyExecutionRepository.ProgressRow latest =
                repository
                        .latestProgress(
                                commitmentId
                        );

        if (
                latest != null
                &&
                input.progressPct()
                        .compareTo(
                                latest.progressPct()
                        )
                < 0
        ) {
            throw new IllegalArgumentException(
                    "Execution progress cannot move backwards."
            );
        }

        if (
                input.blockerCount()
                        > 0
                &&
                (
                        input.blockerSummary()
                                == null
                        ||
                        input.blockerSummary()
                                .trim()
                                .isEmpty()
                )
        ) {
            throw new IllegalArgumentException(
                    "Blocker summary is required when blocker count is greater than zero."
            );
        }

        repository.createProgress(
                UUID.randomUUID(),
                commitmentId,
                input,
                currentUserId
        );

        return commitment(
                currentUserId,
                commitmentId
        );
    }

    public ExecutionCommitmentDetailResponse completeCommitment(
            UUID currentUserId,
            UUID commitmentId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        commitmentId
                );

        if (
                commitment.status()
                        != ExecutionCommitmentStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only in-progress execution commitments can be completed."
            );
        }

        StrategyExecutionRepository.ProgressRow latest =
                repository
                        .latestProgress(
                                commitmentId
                        );

        if (
                latest == null
                ||
                latest.progressPct()
                        .compareTo(
                                new BigDecimal(
                                        "100.00"
                                )
                        )
                < 0
        ) {
            throw new IllegalArgumentException(
                    "Execution commitment requires a 100% progress update before completion."
            );
        }

        if (
                latest.blockerCount()
                        > 0
        ) {
            throw new IllegalArgumentException(
                    "Execution commitment cannot complete while active blockers remain."
            );
        }

        repository.completeCommitment(
                commitmentId
        );

        return commitment(
                currentUserId,
                commitmentId
        );
    }

    public ExecutionCommitmentDetailResponse cancelCommitment(
            UUID currentUserId,
            UUID commitmentId
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        commitmentId
                );

        if (
                commitment.status()
                        == ExecutionCommitmentStatus.COMPLETED
                ||
                commitment.status()
                        == ExecutionCommitmentStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Completed or cancelled execution commitments cannot be cancelled."
            );
        }

        repository.cancelCommitment(
                commitmentId
        );

        return commitment(
                currentUserId,
                commitmentId
        );
    }

    public ExecutionCommitmentDetailResponse reportOutcome(
            UUID currentUserId,
            UUID commitmentId,
            ExecutionOutcomeInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        commitmentId
                );

        if (
                commitment.status()
                        != ExecutionCommitmentStatus.COMPLETED
        ) {
            throw new IllegalArgumentException(
                    "Outcome reporting is allowed only after execution commitment completion."
            );
        }

        StrategyExecutionRepository.OutcomeRow latest =
                repository
                        .latestOutcome(
                                commitmentId
                        );

        if (latest != null) {
            StrategyExecutionRepository.ValidationRow validation =
                    repository
                            .findValidationByOutcome(
                                    latest.id()
                            );

            if (
                    validation == null
                    ||
                    validation.decision()
                            == ExecutionValidationDecision.VALIDATED
            ) {
                throw new IllegalArgumentException(
                        "A new outcome report is allowed only after the previous report has been rejected."
                );
            }
        }

        repository.createOutcomeReport(
                UUID.randomUUID(),
                commitmentId,
                input,
                currentUserId
        );

        return commitment(
                currentUserId,
                commitmentId
        );
    }

    public ExecutionCommitmentDetailResponse validateOutcome(
            UUID currentUserId,
            UUID outcomeId,
            ExecutionOutcomeValidationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyExecutionRepository.OutcomeRow outcome =
                repository
                        .findOutcome(
                                outcomeId
                        );

        if (outcome == null) {
            throw new ResourceNotFoundException(
                    "Execution outcome report not found: "
                            + outcomeId
            );
        }

        if (
                repository
                        .findValidationByOutcome(
                                outcomeId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "Outcome report has already received a validation decision."
            );
        }

        if (
                input.decision()
                        == ExecutionValidationDecision.VALIDATED
        ) {
            if (
                    input.validatedContributionPoints()
                            == null
            ) {
                throw new IllegalArgumentException(
                        "Validated contribution points are required for a VALIDATED outcome."
                );
            }

            if (
                    input.validatedContributionPoints()
                            .compareTo(
                                    outcome.reportedContributionPoints()
                            )
                    > 0
            ) {
                throw new IllegalArgumentException(
                        "Validated contribution cannot exceed the reported contribution."
                );
            }
        } else if (
                input.validatedContributionPoints()
                        != null
        ) {
            throw new IllegalArgumentException(
                    "Rejected outcomes cannot contain validated contribution points."
            );
        }

        repository.createValidation(
                UUID.randomUUID(),
                outcomeId,
                input,
                currentUserId
        );

        return commitment(
                currentUserId,
                outcome.commitmentId()
        );
    }

    public ExecutionReviewDetailResponse captureReview(
            UUID currentUserId,
            UUID roadmapId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRoadmapDetailResponse roadmap =
                strategyRoadmapService
                        .roadmap(
                                currentUserId,
                                roadmapId
                        );

        List<ExecutionCommitmentResponse> commitments =
                repository
                        .commitmentsForRoadmap(
                                roadmapId
                        )
                        .stream()
                        .map(
                                this::commitmentResponse
                        )
                        .toList();

        if (commitments.isEmpty()) {
            throw new IllegalArgumentException(
                    "Roadmap has no imported execution commitments."
            );
        }

        StrategyExecutionSummaryResponse summary =
                summary(
                        commitments
                );

        UUID reviewId =
                UUID.randomUUID();

        repository.createReview(
                reviewId,
                nextReviewNumber(),
                roadmapId,
                roadmap
                        .roadmap()
                        .roadmapNumber(),
                roadmap
                        .roadmap()
                        .title(),
                summary,
                currentUserId
        );

        for (
                ExecutionCommitmentResponse commitment
                : commitments
        ) {
            repository.createReviewItem(
                    reviewId,
                    commitment
            );
        }

        return review(
                currentUserId,
                reviewId
        );
    }

    @Transactional(readOnly = true)
    public ExecutionReviewDetailResponse review(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyExecutionRepository.ReviewRow review =
                repository
                        .findReview(
                                reviewId
                        );

        if (review == null) {
            throw new ResourceNotFoundException(
                    "Execution review not found: "
                            + reviewId
            );
        }

        List<ExecutionCommitmentResponse> commitments =
                repository
                        .reviewItems(
                                reviewId
                        )
                        .stream()
                        .map(
                                item ->
                                        new ExecutionCommitmentResponse(
                                                item.commitmentId(),
                                                item.commitmentNumber(),
                                                review.roadmapId(),
                                                review.roadmapNumber(),
                                                review.roadmapTitle(),
                                                null,
                                                item.initiativeNumber(),
                                                item.initiativeTitle(),
                                                null,
                                                null,
                                                item.ownerName(),
                                                "",
                                                0,
                                                null,
                                                item.plannedEndDate(),
                                                mathService
                                                        .decimal(
                                                                item.plannedContributionPoints()
                                                        ),
                                                item.status(),
                                                mathService
                                                        .decimal(
                                                                item.progressPct()
                                                        ),
                                                item.forecastEndDate(),
                                                item.blockerCount(),
                                                null,
                                                item.executionHealth(),
                                                BigDecimal.ZERO
                                                        .setScale(
                                                                2,
                                                                RoundingMode.HALF_UP
                                                        ),
                                                BigDecimal.ZERO
                                                        .setScale(
                                                                2,
                                                                RoundingMode.HALF_UP
                                                        ),
                                                mathService
                                                        .decimal(
                                                                item.reportedContributionPoints()
                                                        ),
                                                mathService
                                                        .decimal(
                                                                item.validatedContributionPoints()
                                                        ),
                                                mathService
                                                        .decimal(
                                                                item.valueAtRiskPoints()
                                                        ),
                                                null,
                                                null,
                                                null
                                        )
                        )
                        .toList();

        return new ExecutionReviewDetailResponse(
                reviewSummary(
                        review
                ),
                summaryFromReview(
                        review
                ),
                commitments
        );
    }

    private ExecutionCommitmentResponse commitmentResponse(
            StrategyExecutionRepository.CommitmentRow row
    ) {
        StrategyExecutionRepository.ProgressRow latestProgress =
                repository
                        .latestProgress(
                                row.id()
                        );

        BigDecimal progress =
                row.status()
                        == ExecutionCommitmentStatus.COMPLETED
                        ? new BigDecimal(
                                "100.00"
                        )
                        : latestProgress == null
                                ? BigDecimal.ZERO
                                        .setScale(
                                                2,
                                                RoundingMode.HALF_UP
                                        )
                                : mathService
                                        .bounded(
                                                latestProgress.progressPct()
                                        );

        LocalDate forecastEnd =
                latestProgress == null
                        ? row.plannedEndDate()
                        : latestProgress.forecastEndDate();

        int blockers =
                latestProgress == null
                        ? 0
                        : latestProgress.blockerCount();

        String blockerSummary =
                latestProgress == null
                        ? null
                        : latestProgress.blockerSummary();

        ExecutionCommitmentHealth health =
                mathService
                        .commitmentHealth(
                                row.status(),
                                progress,
                                row.plannedStartDate(),
                                row.plannedEndDate(),
                                forecastEnd,
                                blockers,
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        BigDecimal expected =
                row.status()
                        == ExecutionCommitmentStatus.COMPLETED
                        ? new BigDecimal(
                                "100.00"
                        )
                        : mathService
                                .expectedProgress(
                                        row.plannedStartDate(),
                                        row.plannedEndDate(),
                                        LocalDate.now(
                                                ZoneOffset.UTC
                                        )
                                );

        BigDecimal variance =
                progress
                        .subtract(
                                expected
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        StrategyExecutionRepository.OutcomeRow latestOutcome =
                repository
                        .latestOutcome(
                                row.id()
                        );

        BigDecimal reported =
                latestOutcome == null
                        ? BigDecimal.ZERO
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                )
                        : mathService
                                .decimal(
                                        latestOutcome
                                                .reportedContributionPoints()
                                );

        BigDecimal validated =
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        if (latestOutcome != null) {
            StrategyExecutionRepository.ValidationRow validation =
                    repository
                            .findValidationByOutcome(
                                    latestOutcome.id()
                            );

            if (
                    validation != null
                    &&
                    validation.decision()
                            == ExecutionValidationDecision.VALIDATED
            ) {
                validated =
                        mathService
                                .decimal(
                                        validation
                                                .validatedContributionPoints()
                                );
            }
        }

        ExecutionCommitmentMetric metric =
                new ExecutionCommitmentMetric(
                        row.status(),
                        health,
                        progress,
                        row.plannedContributionPoints(),
                        validated
                );

        return new ExecutionCommitmentResponse(
                row.id(),
                row.commitmentNumber(),
                row.sourceRoadmapId(),
                row.sourceRoadmapNumber(),
                row.sourceRoadmapTitle(),
                row.sourceInitiativeId(),
                row.sourceInitiativeNumber(),
                row.sourceInitiativeTitle(),
                row.dimensionKey(),
                row.ownerUserId(),
                row.ownerName(),
                row.currency(),
                row.fiscalYear(),
                row.plannedStartDate(),
                row.plannedEndDate(),
                mathService
                        .decimal(
                                row.plannedContributionPoints()
                        ),
                row.status(),
                progress,
                forecastEnd,
                blockers,
                blockerSummary,
                health,
                expected,
                variance,
                reported,
                validated,
                mathService
                        .valueAtRisk(
                                metric
                        ),
                row.actualStartAt(),
                row.actualCompletedAt(),
                row.cancelledAt()
        );
    }

    private StrategyExecutionSummaryResponse summary(
            List<ExecutionCommitmentResponse> commitments
    ) {
        List<ExecutionCommitmentMetric> metrics =
                commitments.stream()
                        .map(
                                commitment ->
                                        new ExecutionCommitmentMetric(
                                                commitment.status(),
                                                commitment.health(),
                                                commitment.progressPct(),
                                                commitment.plannedContributionPoints(),
                                                commitment.validatedContributionPoints()
                                        )
                        )
                        .toList();

        ExecutionPortfolioResult result =
                mathService
                        .portfolio(
                                metrics
                        );

        return new StrategyExecutionSummaryResponse(
                commitments.size(),
                (
                        int
                ) commitments.stream()
                        .filter(
                                commitment ->
                                        commitment.status()
                                                == ExecutionCommitmentStatus.COMPLETED
                        )
                        .count(),
                (
                        int
                ) commitments.stream()
                        .filter(
                                commitment ->
                                        commitment.health()
                                                == ExecutionCommitmentHealth.BLOCKED
                        )
                        .count(),
                (
                        int
                ) commitments.stream()
                        .filter(
                                commitment ->
                                        commitment.health()
                                                == ExecutionCommitmentHealth.AT_RISK
                        )
                        .count(),
                (
                        int
                ) commitments.stream()
                        .filter(
                                commitment ->
                                        commitment.health()
                                                == ExecutionCommitmentHealth.OVERDUE
                        )
                        .count(),
                commitments.stream()
                        .map(
                                ExecutionCommitmentResponse::
                                        plannedContributionPoints
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                commitments.stream()
                        .map(
                                ExecutionCommitmentResponse::
                                        reportedContributionPoints
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                commitments.stream()
                        .map(
                                ExecutionCommitmentResponse::
                                        validatedContributionPoints
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                result.valueAtRiskPoints(),
                result.averageProgressPct(),
                result.scheduleHealthPct(),
                result.outcomeValidationPct(),
                result.executionScore(),
                result.health()
        );
    }

    private ExecutionProgressResponse progressResponse(
            StrategyExecutionRepository.ProgressRow row
    ) {
        return new ExecutionProgressResponse(
                row.id(),
                row.commitmentId(),
                mathService
                        .bounded(
                                row.progressPct()
                        ),
                row.forecastEndDate(),
                row.blockerCount(),
                row.blockerSummary(),
                row.updateNote(),
                row.createdByName(),
                row.createdAt()
        );
    }

    private ExecutionOutcomeReportResponse outcomeResponse(
            StrategyExecutionRepository.OutcomeRow row
    ) {
        StrategyExecutionRepository.ValidationRow validation =
                repository
                        .findValidationByOutcome(
                                row.id()
                        );

        return new ExecutionOutcomeReportResponse(
                row.id(),
                row.commitmentId(),
                mathService
                        .decimal(
                                row.reportedContributionPoints()
                        ),
                row.evidenceNote(),
                row.reportedByName(),
                row.reportedAt(),
                validation == null
                        ? null
                        : validation.decision(),
                validation == null
                        ? null
                        : validation.validatedContributionPoints(),
                validation == null
                        ? null
                        : validation.validationNote(),
                validation == null
                        ? null
                        : validation.validatedByName(),
                validation == null
                        ? null
                        : validation.validatedAt()
        );
    }

    private ExecutionReviewSummaryResponse reviewSummary(
            StrategyExecutionRepository.ReviewRow row
    ) {
        return new ExecutionReviewSummaryResponse(
                row.id(),
                row.reviewNumber(),
                row.roadmapId(),
                row.roadmapNumber(),
                row.roadmapTitle(),
                row.commitmentCount(),
                row.completedCommitmentCount(),
                row.blockedCommitmentCount(),
                row.atRiskCommitmentCount(),
                row.overdueCommitmentCount(),
                mathService
                        .decimal(
                                row.plannedContributionPoints()
                        ),
                mathService
                        .decimal(
                                row.reportedContributionPoints()
                        ),
                mathService
                        .decimal(
                                row.validatedContributionPoints()
                        ),
                mathService
                        .decimal(
                                row.valueAtRiskPoints()
                        ),
                mathService
                        .bounded(
                                row.executionScore()
                        ),
                row.executionHealth(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private StrategyExecutionSummaryResponse summaryFromReview(
            StrategyExecutionRepository.ReviewRow row
    ) {
        return new StrategyExecutionSummaryResponse(
                row.commitmentCount(),
                row.completedCommitmentCount(),
                row.blockedCommitmentCount(),
                row.atRiskCommitmentCount(),
                row.overdueCommitmentCount(),
                mathService
                        .decimal(
                                row.plannedContributionPoints()
                        ),
                mathService
                        .decimal(
                                row.reportedContributionPoints()
                        ),
                mathService
                        .decimal(
                                row.validatedContributionPoints()
                        ),
                mathService
                        .decimal(
                                row.valueAtRiskPoints()
                        ),
                mathService
                        .bounded(
                                row.averageProgressPct()
                        ),
                mathService
                        .bounded(
                                row.scheduleHealthPct()
                        ),
                mathService
                        .bounded(
                                row.outcomeValidationPct()
                        ),
                mathService
                        .bounded(
                                row.executionScore()
                        ),
                row.executionHealth()
        );
    }

    private StrategyExecutionRepository.CommitmentRow requireCommitment(
            UUID commitmentId
    ) {
        StrategyExecutionRepository.CommitmentRow commitment =
                repository
                        .findCommitment(
                                commitmentId
                        );

        if (commitment == null) {
            throw new ResourceNotFoundException(
                    "Strategic execution commitment not found: "
                            + commitmentId
            );
        }

        return commitment;
    }

    private String nextCommitmentNumber() {
        return String.format(
                "EXEC-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextCommitmentSequence()
        );
    }

    private String nextReviewNumber() {
        return String.format(
                "EXECRVW-%d-%05d",
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
                    "Your ProcureIQ role cannot access strategic execution."
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
                    "Your ProcureIQ role cannot manage strategic execution."
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
                    "Only administrators and procurement managers can validate strategic outcomes or cancel commitments."
            );
        }
    }
}
