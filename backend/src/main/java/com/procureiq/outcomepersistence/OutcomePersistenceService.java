package com.procureiq.outcomepersistence;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.strategyexecution.ExecutionCommitmentResponse;
import com.procureiq.strategyexecution.ExecutionCommitmentStatus;
import com.procureiq.strategyexecution.StrategyExecutionDashboardResponse;
import com.procureiq.strategyexecution.StrategyExecutionService;
import com.procureiq.strategyrecovery.RecoveryCaseResponse;
import com.procureiq.strategyrecovery.RecoveryCaseStatus;
import com.procureiq.strategyrecovery.StrategyRecoveryDashboardResponse;
import com.procureiq.strategyrecovery.StrategyRecoveryService;
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
public class OutcomePersistenceService {

    private final OutcomePersistenceRepository repository;

    private final OutcomePersistenceMathService mathService;

    private final StrategyExecutionService strategyExecutionService;

    private final StrategyRecoveryService strategyRecoveryService;

    private final AppUserRepository appUserRepository;

    public OutcomePersistenceService(
            OutcomePersistenceRepository repository,
            OutcomePersistenceMathService mathService,
            StrategyExecutionService strategyExecutionService,
            StrategyRecoveryService strategyRecoveryService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.strategyExecutionService =
                strategyExecutionService;

        this.strategyRecoveryService =
                strategyRecoveryService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public OutcomePersistenceDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyExecutionDashboardResponse execution =
                strategyExecutionService
                        .dashboard(
                                currentUserId
                        );

        StrategyRecoveryDashboardResponse recovery =
                strategyRecoveryService
                        .dashboard(
                                currentUserId
                        );

        List<PersistenceCandidateResponse> candidates =
                execution
                        .commitments()
                        .stream()
                        .filter(
                                commitment ->
                                        eligibleCandidate(
                                                commitment,
                                                recovery
                                        )
                        )
                        .map(
                                this::candidateResponse
                        )
                        .toList();

        List<PersistencePlanResponse> plans =
                repository
                        .plans()
                        .stream()
                        .map(
                                this::planResponse
                        )
                        .toList();

        return new OutcomePersistenceDashboardResponse(
                summary(
                        candidates.size(),
                        plans
                ),
                repository.users(),
                candidates,
                plans,
                repository
                        .reviews()
                        .stream()
                        .map(
                                this::reviewSummary
                        )
                        .toList()
        );
    }

    public PersistencePlanDetailResponse createPlan(
            UUID currentUserId,
            UUID commitmentId,
            PersistencePlanInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                input.observationEndDate()
                        .isBefore(
                                input.observationStartDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Persistence observation end date cannot precede its start date."
            );
        }

        if (
                input.observationStartDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Persistence observation window cannot begin in the past."
            );
        }

        if (
                repository
                        .activePlanForCommitment(
                                commitmentId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "An active outcome-persistence plan already exists for this commitment."
            );
        }

        ExecutionCommitmentResponse commitment =
                currentCommitment(
                        currentUserId,
                        commitmentId
                );

        StrategyRecoveryDashboardResponse recovery =
                strategyRecoveryService
                        .dashboard(
                                currentUserId
                        );

        if (
                !eligibleCandidate(
                        commitment,
                        recovery
                )
        ) {
            throw new IllegalArgumentException(
                    "Commitment is not eligible for post-implementation persistence governance."
            );
        }

        AppUserEntity persistenceOwner =
                requirePersistenceUser(
                        input.persistenceOwnerUserId()
                );

        UUID planId =
                UUID.randomUUID();

        repository.createPlan(
                planId,
                nextPlanNumber(),
                commitment.id(),
                commitment.commitmentNumber(),
                commitment.sourceRoadmapId(),
                commitment.sourceRoadmapNumber(),
                commitment.sourceInitiativeNumber(),
                commitment.sourceInitiativeTitle(),
                commitment.ownerName(),
                input.persistenceOwnerUserId(),
                persistenceOwner.getFullName(),
                commitment.currency(),
                commitment.fiscalYear(),
                commitment.validatedContributionPoints(),
                input,
                currentUserId
        );

        return plan(
                currentUserId,
                planId
        );
    }

    @Transactional(readOnly = true)
    public PersistencePlanDetailResponse plan(
            UUID currentUserId,
            UUID planId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceRepository.PlanRow plan =
                requirePlan(
                        planId
                );

        return new PersistencePlanDetailResponse(
                planResponse(
                        plan
                ),
                repository.users(),
                repository
                        .observations(
                                planId
                        )
                        .stream()
                        .map(
                                this::observationResponse
                        )
                        .toList(),
                repository
                        .controls(
                                planId
                        )
                        .stream()
                        .map(
                                this::controlResponse
                        )
                        .toList(),
                repository
                        .verifications(
                                planId
                        )
                        .stream()
                        .map(
                                this::verificationResponse
                        )
                        .toList()
        );
    }

    public PersistencePlanDetailResponse recordObservation(
            UUID currentUserId,
            UUID planId,
            PersistenceObservationInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceRepository.PlanRow plan =
                requirePlan(
                        planId
                );

        requireObservationMutable(
                plan
        );

        if (
                input.observedOn()
                        .isBefore(
                                plan.observationStartDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Observation date cannot precede the governed observation window."
            );
        }

        if (
                input.observedOn()
                        .isAfter(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Persistence observations cannot be recorded for a future date."
            );
        }

        repository.createObservation(
                UUID.randomUUID(),
                planId,
                input,
                currentUserId
        );

        return plan(
                currentUserId,
                planId
        );
    }

    public PersistencePlanDetailResponse validateObservation(
            UUID currentUserId,
            UUID observationId,
            PersistenceObservationValidationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceRepository.ObservationRow observation =
                repository
                        .findObservation(
                                observationId
                        );

        if (observation == null) {
            throw new ResourceNotFoundException(
                    "Persistence observation not found: "
                            + observationId
            );
        }

        OutcomePersistenceRepository.PlanRow persistencePlan =
                requirePlan(
                        observation.planId()
                );

        requireObservationMutable(
                persistencePlan
        );

        if (
                repository
                        .findValidation(
                                observationId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "Persistence observation already has a validation decision."
            );
        }

        if (
                input.decision()
                        == PersistenceValidationDecision.VALIDATED
        ) {
            if (
                    input.validatedContributionPoints()
                            == null
            ) {
                throw new IllegalArgumentException(
                    "Validated persistence contribution is required."
                );
            }

            if (
                    input.validatedContributionPoints()
                            .compareTo(
                                    observation.reportedContributionPoints()
                            )
                    > 0
            ) {
                throw new IllegalArgumentException(
                    "Validated persistence contribution cannot exceed the reported observation."
                );
            }
        } else {
            if (
                    input.validatedContributionPoints()
                            != null
            ) {
                throw new IllegalArgumentException(
                    "Rejected persistence observations cannot contain validated contribution."
                );
            }
        }

        repository.createValidation(
                UUID.randomUUID(),
                observationId,
                input,
                currentUserId
        );

        return plan(
                currentUserId,
                persistencePlan.id()
        );
    }

    public PersistencePlanDetailResponse createControl(
            UUID currentUserId,
            UUID planId,
            PersistenceControlInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceRepository.PlanRow plan =
                requirePlan(
                        planId
                );

        if (
                plan.status()
                        != PersistencePlanStatus.ACTIVE
                &&
                plan.status()
                        != PersistencePlanStatus.IN_REMEDIATION
        ) {
            throw new IllegalArgumentException(
                    "Sustainability controls can be managed only while a persistence plan is active or in remediation."
            );
        }

        if (
                input.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Sustainability-control due date cannot be in the past."
            );
        }

        AppUserEntity owner =
                requirePersistenceUser(
                        input.ownerUserId()
                );

        repository.createControl(
                UUID.randomUUID(),
                planId,
                input,
                owner.getFullName(),
                currentUserId
        );

        return plan(
                currentUserId,
                planId
        );
    }

    public PersistencePlanDetailResponse startControl(
            UUID currentUserId,
            UUID controlId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceRepository.ControlRow control =
                requireControl(
                        controlId
                );

        requireControlMutable(
                requirePlan(
                        control.planId()
                )
        );

        if (
                control.status()
                        != PersistenceControlStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned sustainability controls can be started."
            );
        }

        repository.startControl(
                controlId
        );

        return plan(
                currentUserId,
                control.planId()
        );
    }

    public PersistencePlanDetailResponse completeControl(
            UUID currentUserId,
            UUID controlId,
            PersistenceNoteInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceRepository.ControlRow control =
                requireControl(
                        controlId
                );

        requireControlMutable(
                requirePlan(
                        control.planId()
                )
        );

        if (
                control.status()
                        != PersistenceControlStatus.PLANNED
                &&
                control.status()
                        != PersistenceControlStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active sustainability controls can be completed."
            );
        }

        repository.completeControl(
                controlId,
                input.note()
        );

        return plan(
                currentUserId,
                control.planId()
        );
    }

    public PersistencePlanDetailResponse cancelControl(
            UUID currentUserId,
            UUID controlId,
            PersistenceNoteInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceRepository.ControlRow control =
                requireControl(
                        controlId
                );

        requireControlMutable(
                requirePlan(
                        control.planId()
                )
        );

        if (
                control.status()
                        != PersistenceControlStatus.PLANNED
                &&
                control.status()
                        != PersistenceControlStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active sustainability controls can be cancelled."
            );
        }

        repository.cancelControl(
                controlId,
                input.note()
        );

        return plan(
                currentUserId,
                control.planId()
        );
    }

    public PersistencePlanDetailResponse submitForReview(
            UUID currentUserId,
            UUID planId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceRepository.PlanRow plan =
                requirePlan(
                        planId
                );

        if (
                plan.status()
                        != PersistencePlanStatus.ACTIVE
                &&
                plan.status()
                        != PersistencePlanStatus.IN_REMEDIATION
        ) {
            throw new IllegalArgumentException(
                    "Only active or remediation persistence plans can be submitted for review."
            );
        }

        if (
                !verificationEligible(
                        plan
                )
        ) {
            throw new IllegalArgumentException(
                    "Persistence plan does not yet have a validated observation covering the completed observation window."
            );
        }

        boolean unresolvedControl =
                repository
                        .controls(
                                planId
                        )
                        .stream()
                        .anyMatch(
                                control ->
                                        control.status()
                                                == PersistenceControlStatus.PLANNED
                                        ||
                                        control.status()
                                                == PersistenceControlStatus.IN_PROGRESS
                        );

        if (unresolvedControl) {
            throw new IllegalArgumentException(
                    "All sustainability controls must be completed or cancelled before persistence review."
            );
        }

        repository.markReadyForReview(
                planId
        );

        return plan(
                currentUserId,
                planId
        );
    }

    public PersistencePlanDetailResponse verifyPersistence(
            UUID currentUserId,
            UUID planId,
            PersistenceVerificationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceRepository.PlanRow plan =
                requirePlan(
                        planId
                );

        if (
                plan.status()
                        != PersistencePlanStatus.READY_FOR_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only a persistence plan ready for review can be verified."
            );
        }

        OutcomePersistenceRepository.ValidatedObservationRow latest =
                repository
                        .latestValidatedObservation(
                                planId
                        );

        if (
                latest == null
                ||
                latest.observedOn()
                        .isBefore(
                                plan.observationEndDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "A validated end-of-window persistence observation is required."
            );
        }

        PersistenceMetricResult metric =
                mathService
                        .persistence(
                                plan.baselineValidatedContributionPoints(),
                                latest.validatedContributionPoints(),
                                true
                        );

        if (
                input.decision()
                        == PersistenceVerificationDecision.SUSTAINED
                &&
                metric
                        .persistencePct()
                        .compareTo(
                                plan.minimumPersistencePct()
                        )
                < 0
        ) {
            throw new IllegalArgumentException(
                    "Persistence cannot be verified as sustained below the governed minimum persistence threshold."
            );
        }

        repository.createVerification(
                UUID.randomUUID(),
                planId,
                input,
                metric,
                currentUserId
        );

        if (
                input.decision()
                        == PersistenceVerificationDecision.SUSTAINED
        ) {
            repository.markSustained(
                    planId
            );
        } else {
            repository.markRemediationRequired(
                    planId
            );
        }

        return plan(
                currentUserId,
                planId
        );
    }

    public PersistencePlanDetailResponse closePlan(
            UUID currentUserId,
            UUID planId,
            PersistenceNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceRepository.PlanRow plan =
                requirePlan(
                        planId
                );

        if (
                plan.status()
                        != PersistencePlanStatus.SUSTAINED
        ) {
            throw new IllegalArgumentException(
                    "Only a persistence plan verified as sustained can be closed."
            );
        }

        repository.closePlan(
                planId,
                input.note(),
                currentUserId
        );

        return plan(
                currentUserId,
                planId
        );
    }

    public PersistenceReviewDetailResponse captureReview(
            UUID currentUserId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<PersistencePlanResponse> plans =
                repository
                        .plans()
                        .stream()
                        .filter(
                                plan ->
                                        plan.status()
                                                != PersistencePlanStatus.CLOSED
                        )
                        .map(
                                this::planResponse
                        )
                        .toList();

        OutcomePersistenceSummaryResponse summary =
                summary(
                        0,
                        plans
                );

        UUID reviewId =
                UUID.randomUUID();

        repository.createReview(
                reviewId,
                nextReviewNumber(),
                summary,
                currentUserId
        );

        for (
                PersistencePlanResponse plan
                : plans
        ) {
            repository.createReviewItem(
                    reviewId,
                    plan
            );
        }

        return review(
                currentUserId,
                reviewId
        );
    }

    @Transactional(readOnly = true)
    public PersistenceReviewDetailResponse review(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceRepository.ReviewRow review =
                repository
                        .findReview(
                                reviewId
                        );

        if (review == null) {
            throw new ResourceNotFoundException(
                    "Outcome persistence review not found: "
                            + reviewId
            );
        }

        return new PersistenceReviewDetailResponse(
                reviewSummary(
                        review
                ),
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

    private PersistencePlanResponse planResponse(
            OutcomePersistenceRepository.PlanRow plan
    ) {
        OutcomePersistenceRepository.ValidatedObservationRow latest =
                repository
                        .latestValidatedObservation(
                                plan.id()
                        );

        boolean assessed =
                latest != null;

        BigDecimal currentValidated =
                assessed
                        ? mathService
                                .decimal(
                                        latest.validatedContributionPoints()
                                )
                        : BigDecimal.ZERO
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                );

        PersistenceMetricResult metric =
                mathService
                        .persistence(
                                plan.baselineValidatedContributionPoints(),
                                currentValidated,
                                assessed
                        );

        List<OutcomePersistenceRepository.ControlRow> controls =
                repository
                        .controls(
                                plan.id()
                        );

        int openControls =
                (
                        int
                ) controls.stream()
                        .filter(
                                control ->
                                        control.status()
                                                == PersistenceControlStatus.PLANNED
                                        ||
                                        control.status()
                                                == PersistenceControlStatus.IN_PROGRESS
                        )
                        .count();

        int overdueControls =
                (
                        int
                ) controls.stream()
                        .filter(
                                this::controlOverdue
                        )
                        .count();

        boolean observationDue =
                !plan
                        .observationEndDate()
                        .isAfter(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
                &&
                (
                        latest == null
                        ||
                        latest
                                .observedOn()
                                .isBefore(
                                        plan.observationEndDate()
                                )
                );

        return new PersistencePlanResponse(
                plan.id(),
                plan.planNumber(),
                plan.commitmentId(),
                plan.commitmentNumber(),
                plan.roadmapId(),
                plan.roadmapNumber(),
                plan.initiativeNumber(),
                plan.initiativeTitle(),
                plan.executionOwnerName(),
                plan.persistenceOwnerUserId(),
                plan.persistenceOwnerName(),
                plan.currency(),
                plan.fiscalYear(),
                mathService
                        .decimal(
                                plan.baselineValidatedContributionPoints()
                        ),
                plan.observationStartDate(),
                plan.observationEndDate(),
                mathService
                        .bounded(
                                plan.minimumPersistencePct()
                        ),
                plan.persistenceObjective(),
                plan.status(),

                assessed,
                currentValidated,
                metric.persistencePct(),
                metric.decayPoints(),
                metric.health(),

                observationDue,
                verificationEligible(
                        plan
                ),
                repository
                        .observations(
                                plan.id()
                        )
                        .size(),
                repository
                        .verifications(
                                plan.id()
                        )
                        .size(),
                openControls,
                overdueControls,

                plan.closeNote(),
                plan.closedByName(),
                plan.closedAt(),
                plan.createdAt(),
                plan.updatedAt(),
                plan.version()
        );
    }

    private PersistenceCandidateResponse candidateResponse(
            ExecutionCommitmentResponse commitment
    ) {
        return new PersistenceCandidateResponse(
                commitment.id(),
                commitment.commitmentNumber(),
                commitment.sourceRoadmapId(),
                commitment.sourceRoadmapNumber(),
                commitment.sourceInitiativeNumber(),
                commitment.sourceInitiativeTitle(),
                commitment.ownerName(),
                commitment.currency(),
                commitment.fiscalYear(),
                commitment
                        .actualCompletedAt()
                        .atZone(
                                ZoneOffset.UTC
                        )
                        .toLocalDate(),
                mathService
                        .decimal(
                                commitment.validatedContributionPoints()
                        )
        );
    }

    private PersistenceObservationResponse observationResponse(
            OutcomePersistenceRepository.ObservationRow row
    ) {
        OutcomePersistenceRepository.ValidationRow validation =
                repository
                        .findValidation(
                                row.id()
                        );

        return new PersistenceObservationResponse(
                row.id(),
                row.planId(),
                row.observedOn(),
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

    private PersistenceControlResponse controlResponse(
            OutcomePersistenceRepository.ControlRow row
    ) {
        return new PersistenceControlResponse(
                row.id(),
                row.planId(),
                row.title(),
                row.description(),
                row.ownerUserId(),
                row.ownerName(),
                row.dueDate(),
                row.status(),
                controlOverdue(
                        row
                ),
                row.completionEvidence(),
                row.startedAt(),
                row.completedAt(),
                row.cancelledAt(),
                row.createdAt(),
                row.version()
        );
    }

    private PersistenceVerificationResponse verificationResponse(
            OutcomePersistenceRepository.VerificationRow row
    ) {
        return new PersistenceVerificationResponse(
                row.id(),
                row.planId(),
                row.decision(),
                mathService
                        .bounded(
                                row.persistencePct()
                        ),
                mathService
                        .decimal(
                                row.decayPoints()
                        ),
                row.persistenceHealth(),
                row.verificationNote(),
                row.verifiedByName(),
                row.verifiedAt()
        );
    }

    private OutcomePersistenceSummaryResponse summary(
            int candidateCount,
            List<PersistencePlanResponse> plans
    ) {
        List<PersistencePlanResponse> active =
                plans.stream()
                        .filter(
                                plan ->
                                        plan.status()
                                                != PersistencePlanStatus.CLOSED
                        )
                        .toList();

        List<PersistencePlanResponse> assessed =
                active.stream()
                        .filter(
                                PersistencePlanResponse::
                                        assessed
                        )
                        .toList();

        List<PersistenceMetricResult> metrics =
                assessed.stream()
                        .map(
                                plan ->
                                        new PersistenceMetricResult(
                                                plan.persistencePct(),
                                                plan.decayPoints(),
                                                plan.persistenceHealth()
                                        )
                        )
                        .toList();

        return new OutcomePersistenceSummaryResponse(
                candidateCount,

                (
                        int
                ) active.stream()
                        .filter(
                                plan ->
                                        plan.status()
                                                == PersistencePlanStatus.ACTIVE
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                plan ->
                                        plan.status()
                                                == PersistencePlanStatus.IN_REMEDIATION
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                plan ->
                                        plan.status()
                                                == PersistencePlanStatus.READY_FOR_REVIEW
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                plan ->
                                        plan.status()
                                                == PersistencePlanStatus.SUSTAINED
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                PersistencePlanResponse::
                                        observationDue
                        )
                        .count(),

                (
                        int
                ) assessed.stream()
                        .filter(
                                plan ->
                                        plan.persistenceHealth()
                                                == PersistenceHealth.DECAYING
                                        ||
                                        plan.persistenceHealth()
                                                == PersistenceHealth.REGRESSED
                        )
                        .count(),

                active.stream()
                        .mapToInt(
                                PersistencePlanResponse::
                                        overdueControlCount
                        )
                        .sum(),

                assessed.stream()
                        .map(
                                PersistencePlanResponse::
                                        baselineValidatedContributionPoints
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),

                assessed.stream()
                        .map(
                                PersistencePlanResponse::
                                        currentValidatedContributionPoints
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),

                assessed.stream()
                        .map(
                                PersistencePlanResponse::
                                        decayPoints
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),

                mathService
                        .average(
                                assessed.stream()
                                        .map(
                                                PersistencePlanResponse::
                                                        persistencePct
                                        )
                                        .toList()
                        ),

                mathService
                        .portfolioHealth(
                                metrics
                        )
        );
    }

    private PersistenceReviewSummaryResponse reviewSummary(
            OutcomePersistenceRepository.ReviewRow row
    ) {
        return new PersistenceReviewSummaryResponse(
                row.id(),
                row.reviewNumber(),
                row.activePlanCount(),
                row.remediationPlanCount(),
                row.readyForReviewCount(),
                row.sustainedPlanCount(),
                row.dueObservationCount(),
                row.decayedPlanCount(),
                row.overdueControlCount(),
                mathService
                        .decimal(
                                row.assessedBaselinePoints()
                        ),
                mathService
                        .decimal(
                                row.currentValidatedPoints()
                        ),
                mathService
                        .decimal(
                                row.totalDecayPoints()
                        ),
                mathService
                        .bounded(
                                row.averagePersistencePct()
                        ),
                row.portfolioHealth(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private PersistenceReviewItemResponse reviewItemResponse(
            OutcomePersistenceRepository.ReviewItemRow row
    ) {
        return new PersistenceReviewItemResponse(
                row.planId(),
                row.planNumber(),
                row.commitmentNumber(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                row.persistenceOwnerName(),
                row.planStatus(),
                mathService
                        .decimal(
                                row.baselineValidatedPoints()
                        ),
                mathService
                        .decimal(
                                row.currentValidatedPoints()
                        ),
                mathService
                        .bounded(
                                row.persistencePct()
                        ),
                mathService
                        .decimal(
                                row.decayPoints()
                        ),
                row.persistenceHealth(),
                row.observationDue(),
                row.verificationEligible(),
                row.openControlCount(),
                row.overdueControlCount(),
                row.observationCount(),
                row.verificationCount()
        );
    }

    private boolean eligibleCandidate(
            ExecutionCommitmentResponse commitment,
            StrategyRecoveryDashboardResponse recovery
    ) {
        if (
                commitment.status()
                        != ExecutionCommitmentStatus.COMPLETED
        ) {
            return false;
        }

        if (
                commitment
                        .validatedContributionPoints()
                        .compareTo(
                                BigDecimal.ZERO
                        )
                <= 0
        ) {
            return false;
        }

        if (
                commitment.actualCompletedAt()
                        == null
        ) {
            return false;
        }

        if (
                repository
                        .activePlanForCommitment(
                                commitment.id()
                        )
                != null
        ) {
            return false;
        }

        return recovery
                .cases()
                .stream()
                .noneMatch(
                        recoveryCase ->
                                recoveryCase.commitmentId()
                                        != null
                                &&
                                recoveryCase
                                        .commitmentId()
                                        .equals(
                                                commitment.id()
                                        )
                                &&
                                recoveryCase.status()
                                        != RecoveryCaseStatus.CLOSED
                );
    }

    private boolean verificationEligible(
            OutcomePersistenceRepository.PlanRow plan
    ) {
        if (
                LocalDate.now(
                        ZoneOffset.UTC
                )
                        .isBefore(
                                plan.observationEndDate()
                        )
        ) {
            return false;
        }

        OutcomePersistenceRepository.ValidatedObservationRow latest =
                repository
                        .latestValidatedObservation(
                                plan.id()
                        );

        if (
                latest == null
                ||
                latest
                        .observedOn()
                        .isBefore(
                                plan.observationEndDate()
                        )
        ) {
            return false;
        }

        return repository
                .controls(
                        plan.id()
                )
                .stream()
                .noneMatch(
                        control ->
                                control.status()
                                        == PersistenceControlStatus.PLANNED
                                ||
                                control.status()
                                        == PersistenceControlStatus.IN_PROGRESS
                );
    }

    private boolean controlOverdue(
            OutcomePersistenceRepository.ControlRow control
    ) {
        return (
                control.status()
                        == PersistenceControlStatus.PLANNED
                ||
                control.status()
                        == PersistenceControlStatus.IN_PROGRESS
        )
                &&
                control
                        .dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );
    }

    private ExecutionCommitmentResponse currentCommitment(
            UUID currentUserId,
            UUID commitmentId
    ) {
        return strategyExecutionService
                .commitment(
                        currentUserId,
                        commitmentId
                )
                .commitment();
    }

    private OutcomePersistenceRepository.PlanRow requirePlan(
            UUID planId
    ) {
        OutcomePersistenceRepository.PlanRow plan =
                repository
                        .findPlan(
                                planId
                        );

        if (plan == null) {
            throw new ResourceNotFoundException(
                    "Outcome persistence plan not found: "
                            + planId
            );
        }

        return plan;
    }

    private OutcomePersistenceRepository.ControlRow requireControl(
            UUID controlId
    ) {
        OutcomePersistenceRepository.ControlRow control =
                repository
                        .findControl(
                                controlId
                        );

        if (control == null) {
            throw new ResourceNotFoundException(
                    "Outcome persistence control not found: "
                            + controlId
            );
        }

        return control;
    }

    private void requireObservationMutable(
            OutcomePersistenceRepository.PlanRow plan
    ) {
        if (
                plan.status()
                        != PersistencePlanStatus.ACTIVE
                &&
                plan.status()
                        != PersistencePlanStatus.IN_REMEDIATION
        ) {
            throw new IllegalArgumentException(
                    "Persistence observations can be recorded only while a plan is active or in remediation."
            );
        }
    }

    private void requireControlMutable(
            OutcomePersistenceRepository.PlanRow plan
    ) {
        if (
                plan.status()
                        != PersistencePlanStatus.ACTIVE
                &&
                plan.status()
                        != PersistencePlanStatus.IN_REMEDIATION
        ) {
            throw new IllegalArgumentException(
                    "Persistence controls can be changed only while a plan is active or in remediation."
            );
        }
    }

    private AppUserEntity requirePersistenceUser(
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
                    "Requester accounts cannot own outcome-persistence governance."
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

    private String nextPlanNumber() {
        return String.format(
                "PERSIST-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextPlanSequence()
        );
    }

    private String nextReviewNumber() {
        return String.format(
                "PERSRVW-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextReviewSequence()
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
                    "Your ProcureIQ role cannot access outcome-persistence governance."
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
                    "Your ProcureIQ role cannot manage outcome-persistence governance."
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
                    "Only administrators and procurement managers can validate or verify persistent strategic value."
            );
        }
    }
}
