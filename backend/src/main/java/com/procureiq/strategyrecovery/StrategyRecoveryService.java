package com.procureiq.strategyrecovery;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.strategyexecution.ExecutionCommitmentHealth;
import com.procureiq.strategyexecution.ExecutionCommitmentResponse;
import com.procureiq.strategyexecution.ExecutionCommitmentStatus;
import com.procureiq.strategyexecution.StrategyExecutionDashboardResponse;
import com.procureiq.strategyexecution.StrategyExecutionService;
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
public class StrategyRecoveryService {

    private final StrategyRecoveryRepository repository;

    private final StrategyRecoveryMathService mathService;

    private final StrategyExecutionService strategyExecutionService;

    private final AppUserRepository appUserRepository;

    public StrategyRecoveryService(
            StrategyRecoveryRepository repository,
            StrategyRecoveryMathService mathService,
            StrategyExecutionService strategyExecutionService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.strategyExecutionService =
                strategyExecutionService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public StrategyRecoveryDashboardResponse dashboard(
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

        List<RecoveryCandidateResponse> candidates =
                execution
                        .commitments()
                        .stream()
                        .filter(
                                this::recoverable
                        )
                        .filter(
                                commitment ->
                                        repository
                                                .activeCaseForCommitment(
                                                        commitment.id()
                                                )
                                        == null
                        )
                        .map(
                                this::candidateResponse
                        )
                        .toList();

        List<RecoveryCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .map(
                                row ->
                                        caseResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        return new StrategyRecoveryDashboardResponse(
                summary(
                        candidates.size(),
                        cases
                ),
                repository.users(),
                candidates,
                cases,
                repository
                        .reviews()
                        .stream()
                        .map(
                                this::reviewSummary
                        )
                        .toList()
        );
    }

    public RecoveryCaseDetailResponse openCase(
            UUID currentUserId,
            UUID commitmentId,
            RecoveryCaseInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                input.targetRecoveryDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Recovery target date cannot be in the past."
            );
        }

        if (
                repository
                        .activeCaseForCommitment(
                                commitmentId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "An active recovery case already exists for this execution commitment."
            );
        }

        ExecutionCommitmentResponse commitment =
                currentCommitment(
                        currentUserId,
                        commitmentId
                );

        if (!recoverable(
                commitment
        )) {
            throw new IllegalArgumentException(
                    "Execution commitment does not currently meet recovery-variance criteria."
            );
        }

        AppUserEntity recoveryOwner =
                requireRecoveryUser(
                        input.recoveryOwnerUserId()
                );

        BigDecimal baselineRisk =
                riskScore(
                        commitment
                );

        UUID caseId =
                UUID.randomUUID();

        repository.createCase(
                caseId,
                nextRecoveryNumber(),
                commitment.id(),
                commitment.commitmentNumber(),
                commitment.sourceRoadmapId(),
                commitment.sourceRoadmapNumber(),
                commitment.sourceInitiativeNumber(),
                commitment.sourceInitiativeTitle(),
                commitment.ownerName(),
                input.recoveryOwnerUserId(),
                recoveryOwner.getFullName(),
                mathService
                        .severity(
                                baselineRisk
                        ),
                input,
                commitment.health(),
                commitment.progressPct(),
                commitment.forecastEndDate(),
                commitment.blockerCount(),
                commitment.plannedContributionPoints(),
                commitment.validatedContributionPoints(),
                commitment.valueAtRiskPoints(),
                baselineRisk,
                currentUserId
        );

        captureCheckpointInternal(
                currentUserId,
                requireCase(
                        caseId
                ),
                "Recovery baseline captured when the case was opened."
        );

        return recoveryCase(
                currentUserId,
                caseId
        );
    }

    @Transactional(readOnly = true)
    public RecoveryCaseDetailResponse recoveryCase(
            UUID currentUserId,
            UUID caseId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.CaseRow recoveryCase =
                requireCase(
                        caseId
                );

        return new RecoveryCaseDetailResponse(
                caseResponse(
                        currentUserId,
                        recoveryCase
                ),
                repository
                        .actions(
                                caseId
                        )
                        .stream()
                        .map(
                                this::actionResponse
                        )
                        .toList(),
                repository
                        .checkpoints(
                                caseId
                        )
                        .stream()
                        .map(
                                this::checkpointResponse
                        )
                        .toList(),
                repository
                        .escalations(
                                caseId
                        )
                        .stream()
                        .map(
                                this::escalationResponse
                        )
                        .toList()
        );
    }

    public RecoveryCaseDetailResponse startRecovery(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.CaseRow recoveryCase =
                requireCase(
                        caseId
                );

        if (
                recoveryCase.status()
                        != RecoveryCaseStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only an open recovery case can enter recovery."
            );
        }

        if (
                repository
                        .actions(
                                caseId
                        )
                        .isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "At least one corrective action is required before recovery can start."
            );
        }

        repository.startRecovery(
                caseId
        );

        return recoveryCase(
                currentUserId,
                caseId
        );
    }

    public RecoveryCaseDetailResponse createAction(
            UUID currentUserId,
            UUID caseId,
            RecoveryActionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.CaseRow recoveryCase =
                requireCase(
                        caseId
                );

        requireMutableCase(
                recoveryCase
        );

        if (
                input.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Corrective-action due date cannot be in the past."
            );
        }

        if (
                input.dueDate()
                        .isAfter(
                                recoveryCase.targetRecoveryDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Corrective-action due date cannot exceed the recovery target date."
            );
        }

        AppUserEntity owner =
                requireRecoveryUser(
                        input.ownerUserId()
                );

        repository.createAction(
                UUID.randomUUID(),
                caseId,
                input,
                owner.getFullName(),
                currentUserId
        );

        return recoveryCase(
                currentUserId,
                caseId
        );
    }

    public RecoveryCaseDetailResponse startAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.ActionRow action =
                requireAction(
                        actionId
                );

        requireMutableCase(
                requireCase(
                        action.recoveryCaseId()
                )
        );

        if (
                action.status()
                        != RecoveryActionStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned recovery actions can be started."
            );
        }

        repository.startAction(
                actionId
        );

        return recoveryCase(
                currentUserId,
                action.recoveryCaseId()
        );
    }

    public RecoveryCaseDetailResponse completeAction(
            UUID currentUserId,
            UUID actionId,
            RecoveryNoteInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.ActionRow action =
                requireAction(
                        actionId
                );

        requireMutableCase(
                requireCase(
                        action.recoveryCaseId()
                )
        );

        if (
                action.status()
                        != RecoveryActionStatus.PLANNED
                &&
                action.status()
                        != RecoveryActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active recovery actions can be completed."
            );
        }

        repository.completeAction(
                actionId,
                input.note()
        );

        return recoveryCase(
                currentUserId,
                action.recoveryCaseId()
        );
    }

    public RecoveryCaseDetailResponse cancelAction(
            UUID currentUserId,
            UUID actionId,
            RecoveryNoteInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.ActionRow action =
                requireAction(
                        actionId
                );

        requireMutableCase(
                requireCase(
                        action.recoveryCaseId()
                )
        );

        if (
                action.status()
                        != RecoveryActionStatus.PLANNED
                &&
                action.status()
                        != RecoveryActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active recovery actions can be cancelled."
            );
        }

        repository.cancelAction(
                actionId,
                input.note()
        );

        return recoveryCase(
                currentUserId,
                action.recoveryCaseId()
        );
    }

    public RecoveryCaseDetailResponse captureCheckpoint(
            UUID currentUserId,
            UUID caseId,
            RecoveryCheckpointInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.CaseRow recoveryCase =
                requireCase(
                        caseId
                );

        if (
                recoveryCase.status()
                        == RecoveryCaseStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Closed recovery cases cannot receive new checkpoints."
            );
        }

        captureCheckpointInternal(
                currentUserId,
                recoveryCase,
                input.checkpointNote()
        );

        return recoveryCase(
                currentUserId,
                caseId
        );
    }

    public RecoveryCaseDetailResponse escalate(
            UUID currentUserId,
            UUID caseId,
            RecoveryEscalationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.CaseRow recoveryCase =
                requireCase(
                        caseId
                );

        if (
                recoveryCase.status()
                        == RecoveryCaseStatus.VERIFIED
                ||
                recoveryCase.status()
                        == RecoveryCaseStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Verified or closed recovery cases cannot be escalated."
            );
        }

        repository.createEscalation(
                UUID.randomUUID(),
                caseId,
                input,
                currentUserId
        );

        return recoveryCase(
                currentUserId,
                caseId
        );
    }

    public RecoveryCaseDetailResponse markReadyForVerification(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.CaseRow recoveryCase =
                requireCase(
                        caseId
                );

        if (
                recoveryCase.status()
                        != RecoveryCaseStatus.IN_RECOVERY
        ) {
            throw new IllegalArgumentException(
                    "Only an in-recovery case can be submitted for verification."
            );
        }

        List<StrategyRecoveryRepository.ActionRow> actions =
                repository
                        .actions(
                                caseId
                        );

        if (actions.isEmpty()) {
            throw new IllegalArgumentException(
                    "Recovery verification requires corrective-action evidence."
            );
        }

        boolean unresolvedAction =
                actions.stream()
                        .anyMatch(
                                action ->
                                        action.status()
                                                == RecoveryActionStatus.PLANNED
                                        ||
                                        action.status()
                                                == RecoveryActionStatus.IN_PROGRESS
                        );

        if (unresolvedAction) {
            throw new IllegalArgumentException(
                    "All recovery actions must be completed or cancelled before verification."
            );
        }

        RecoveryCaseResponse current =
                caseResponse(
                        currentUserId,
                        recoveryCase
                );

        if (
                !current.verificationEligible()
        ) {
            throw new IllegalArgumentException(
                    "Current Step 53 execution evidence does not meet deterministic recovery-verification criteria."
            );
        }

        captureCheckpointInternal(
                currentUserId,
                recoveryCase,
                "Recovery case submitted for independent verification."
        );

        repository.markReadyForVerification(
                caseId
        );

        return recoveryCase(
                currentUserId,
                caseId
        );
    }

    public RecoveryCaseDetailResponse verify(
            UUID currentUserId,
            UUID caseId,
            RecoveryNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.CaseRow recoveryCase =
                requireCase(
                        caseId
                );

        if (
                recoveryCase.status()
                        != RecoveryCaseStatus.READY_FOR_VERIFICATION
        ) {
            throw new IllegalArgumentException(
                    "Only a recovery case ready for verification can be verified."
            );
        }

        RecoveryCaseResponse current =
                caseResponse(
                        currentUserId,
                        recoveryCase
                );

        if (
                !current.verificationEligible()
        ) {
            throw new IllegalArgumentException(
                    "Current Step 53 evidence no longer satisfies recovery-verification criteria."
            );
        }

        captureCheckpointInternal(
                currentUserId,
                recoveryCase,
                "Independent recovery verification checkpoint."
        );

        repository.verifyCase(
                caseId,
                input.note(),
                currentUserId
        );

        return recoveryCase(
                currentUserId,
                caseId
        );
    }

    public RecoveryCaseDetailResponse close(
            UUID currentUserId,
            UUID caseId,
            RecoveryNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.CaseRow recoveryCase =
                requireCase(
                        caseId
                );

        if (
                recoveryCase.status()
                        != RecoveryCaseStatus.VERIFIED
        ) {
            throw new IllegalArgumentException(
                    "Only a verified recovery case can be closed."
            );
        }

        repository.closeCase(
                caseId,
                input.note(),
                currentUserId
        );

        return recoveryCase(
                currentUserId,
                caseId
        );
    }

    public RecoveryReviewDetailResponse captureReview(
            UUID currentUserId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<RecoveryCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .filter(
                                row ->
                                        row.status()
                                                != RecoveryCaseStatus.CLOSED
                        )
                        .map(
                                row ->
                                        caseResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        StrategyRecoverySummaryResponse summary =
                summary(
                        0,
                        cases
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
                RecoveryCaseResponse recoveryCase
                : cases
        ) {
            repository.createReviewItem(
                    reviewId,
                    recoveryCase
            );
        }

        return review(
                currentUserId,
                reviewId
        );
    }

    @Transactional(readOnly = true)
    public RecoveryReviewDetailResponse review(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyRecoveryRepository.ReviewRow review =
                repository
                        .findReview(
                                reviewId
                        );

        if (review == null) {
            throw new ResourceNotFoundException(
                    "Strategy recovery review not found: "
                            + reviewId
            );
        }

        List<RecoveryCaseResponse> cases =
                repository
                        .reviewItems(
                                reviewId
                        )
                        .stream()
                        .map(
                                this::reviewCaseResponse
                        )
                        .toList();

        return new RecoveryReviewDetailResponse(
                reviewSummary(
                        review
                ),
                cases
        );
    }

    private void captureCheckpointInternal(
            UUID currentUserId,
            StrategyRecoveryRepository.CaseRow recoveryCase,
            String note
    ) {
        ExecutionCommitmentResponse commitment =
                currentCommitment(
                        currentUserId,
                        recoveryCase.commitmentId()
                );

        boolean eligible =
                verificationEligible(
                        commitment
                );

        BigDecimal currentRisk =
                riskScore(
                        commitment
                );

        RecoveryMetricResult metric =
                mathService
                        .recovery(
                                recoveryCase
                                        .baselineRiskScore(),
                                currentRisk,
                                eligible
                        );

        repository.createCheckpoint(
                UUID.randomUUID(),
                recoveryCase.id(),
                commitment.id(),
                commitment.health(),
                commitment.progressPct(),
                commitment.forecastEndDate(),
                commitment.blockerCount(),
                commitment.validatedContributionPoints(),
                commitment.valueAtRiskPoints(),
                metric,
                note,
                currentUserId
        );
    }

    private RecoveryCandidateResponse candidateResponse(
            ExecutionCommitmentResponse commitment
    ) {
        BigDecimal risk =
                riskScore(
                        commitment
                );

        return new RecoveryCandidateResponse(
                commitment.id(),
                commitment.commitmentNumber(),
                commitment.sourceRoadmapId(),
                commitment.sourceRoadmapNumber(),
                commitment.sourceInitiativeNumber(),
                commitment.sourceInitiativeTitle(),
                commitment.ownerName(),
                commitment.health(),
                commitment.progressPct(),
                commitment.plannedEndDate(),
                commitment.forecastEndDate(),
                commitment.blockerCount(),
                commitment.plannedContributionPoints(),
                commitment.validatedContributionPoints(),
                commitment.valueAtRiskPoints(),
                risk,
                mathService
                        .severity(
                                risk
                        )
        );
    }

    private RecoveryCaseResponse caseResponse(
            UUID currentUserId,
            StrategyRecoveryRepository.CaseRow row
    ) {
        ExecutionCommitmentResponse commitment =
                currentCommitment(
                        currentUserId,
                        row.commitmentId()
                );

        List<StrategyRecoveryRepository.ActionRow> actions =
                repository
                        .actions(
                                row.id()
                        );

        int openActions =
                (
                        int
                ) actions.stream()
                        .filter(
                                action ->
                                        action.status()
                                                == RecoveryActionStatus.PLANNED
                                        ||
                                        action.status()
                                                == RecoveryActionStatus.IN_PROGRESS
                        )
                        .count();

        int overdueActions =
                (
                        int
                ) actions.stream()
                        .filter(
                                this::actionOverdue
                        )
                        .count();

        int escalationCount =
                repository
                        .escalations(
                                row.id()
                        )
                        .size();

        boolean eligible =
                verificationEligible(
                        commitment
                );

        BigDecimal currentRisk =
                riskScore(
                        commitment
                );

        RecoveryMetricResult metric =
                mathService
                        .recovery(
                                row.baselineRiskScore(),
                                currentRisk,
                                eligible
                        );

        return new RecoveryCaseResponse(
                row.id(),
                row.recoveryNumber(),
                row.commitmentId(),
                row.commitmentNumber(),
                row.roadmapId(),
                row.roadmapNumber(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                row.executionOwnerName(),
                row.recoveryOwnerUserId(),
                row.recoveryOwnerName(),
                row.severity(),
                row.status(),
                row.recoveryObjective(),
                row.targetRecoveryDate(),

                row.baselineExecutionHealth(),
                mathService
                        .bounded(
                                row.baselineProgressPct()
                        ),
                row.baselineForecastEndDate(),
                row.baselineBlockerCount(),
                mathService
                        .decimal(
                                row.baselinePlannedContributionPoints()
                        ),
                mathService
                        .decimal(
                                row.baselineValidatedContributionPoints()
                        ),
                mathService
                        .decimal(
                                row.baselineValueAtRiskPoints()
                        ),
                mathService
                        .bounded(
                                row.baselineRiskScore()
                        ),

                commitment.health(),
                mathService
                        .bounded(
                                commitment.progressPct()
                        ),
                commitment.forecastEndDate(),
                commitment.blockerCount(),
                mathService
                        .decimal(
                                commitment.validatedContributionPoints()
                        ),
                mathService
                        .decimal(
                                commitment.valueAtRiskPoints()
                        ),
                metric.currentRiskScore(),
                metric.recoveryScore(),
                metric.effectivenessPct(),
                metric.recoveryHealth(),
                eligible,

                openActions,
                overdueActions,
                escalationCount,

                row.verificationNote(),
                row.verifiedByName(),
                row.verifiedAt(),
                row.closeNote(),
                row.closedByName(),
                row.closedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private RecoveryCaseResponse reviewCaseResponse(
            StrategyRecoveryRepository.ReviewItemRow row
    ) {
        return new RecoveryCaseResponse(
                row.recoveryCaseId(),
                row.recoveryNumber(),
                null,
                row.commitmentNumber(),
                null,
                "",
                row.initiativeNumber(),
                row.initiativeTitle(),
                "",
                null,
                row.recoveryOwnerName(),
                row.severity(),
                row.recoveryStatus(),
                "",
                null,

                ExecutionCommitmentHealth.NOT_STARTED,
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                null,
                0,
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
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                mathService
                        .bounded(
                                row.baselineRiskScore()
                        ),

                ExecutionCommitmentHealth.NOT_STARTED,
                mathService
                        .bounded(
                                row.currentProgressPct()
                        ),
                row.currentForecastEndDate(),
                row.currentBlockerCount(),
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                mathService
                        .decimal(
                                row.currentValueAtRiskPoints()
                        ),
                mathService
                        .bounded(
                                row.currentRiskScore()
                        ),
                mathService
                        .bounded(
                                row.recoveryScore()
                        ),
                mathService
                        .bounded(
                                row.effectivenessPct()
                        ),
                row.recoveryHealth(),
                row.verificationEligible(),

                row.openActionCount(),
                row.overdueActionCount(),
                row.escalationCount(),

                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                0
        );
    }

    private StrategyRecoverySummaryResponse summary(
            int candidateCount,
            List<RecoveryCaseResponse> cases
    ) {
        List<RecoveryCaseResponse> active =
                cases.stream()
                        .filter(
                                recoveryCase ->
                                        recoveryCase.status()
                                                != RecoveryCaseStatus.CLOSED
                        )
                        .toList();

        List<RecoveryMetricResult> metrics =
                active.stream()
                        .map(
                                recoveryCase ->
                                        new RecoveryMetricResult(
                                                recoveryCase.currentRiskScore(),
                                                recoveryCase.recoveryScore(),
                                                recoveryCase.effectivenessPct(),
                                                recoveryCase.recoveryHealth()
                                        )
                        )
                        .toList();

        return new StrategyRecoverySummaryResponse(
                candidateCount,

                (
                        int
                ) active.stream()
                        .filter(
                                recoveryCase ->
                                        recoveryCase.status()
                                                == RecoveryCaseStatus.OPEN
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                recoveryCase ->
                                        recoveryCase.status()
                                                == RecoveryCaseStatus.IN_RECOVERY
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                recoveryCase ->
                                        recoveryCase.status()
                                                == RecoveryCaseStatus.READY_FOR_VERIFICATION
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                recoveryCase ->
                                        recoveryCase.status()
                                                == RecoveryCaseStatus.VERIFIED
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                recoveryCase ->
                                        recoveryCase.severity()
                                                == RecoverySeverity.CRITICAL
                        )
                        .count(),

                active.stream()
                        .mapToInt(
                                RecoveryCaseResponse::
                                        overdueActionCount
                        )
                        .sum(),

                active.stream()
                        .mapToInt(
                                RecoveryCaseResponse::
                                        escalationCount
                        )
                        .sum(),

                active.stream()
                        .map(
                                RecoveryCaseResponse::
                                        baselineValueAtRiskPoints
                        )
                        .filter(
                                java.util.Objects::nonNull
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),

                active.stream()
                        .map(
                                RecoveryCaseResponse::
                                        currentValueAtRiskPoints
                        )
                        .filter(
                                java.util.Objects::nonNull
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
                                active.stream()
                                        .map(
                                                RecoveryCaseResponse::
                                                        effectivenessPct
                                        )
                                        .toList()
                        ),

                mathService
                        .average(
                                active.stream()
                                        .map(
                                                RecoveryCaseResponse::
                                                        recoveryScore
                                        )
                                        .toList()
                        ),

                mathService
                        .portfolioHealth(
                                metrics
                        )
        );
    }

    private RecoveryActionResponse actionResponse(
            StrategyRecoveryRepository.ActionRow row
    ) {
        return new RecoveryActionResponse(
                row.id(),
                row.recoveryCaseId(),
                row.title(),
                row.description(),
                row.ownerUserId(),
                row.ownerName(),
                row.dueDate(),
                row.status(),
                actionOverdue(
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

    private RecoveryCheckpointResponse checkpointResponse(
            StrategyRecoveryRepository.CheckpointRow row
    ) {
        return new RecoveryCheckpointResponse(
                row.id(),
                row.recoveryCaseId(),
                row.executionHealth(),
                mathService
                        .bounded(
                                row.progressPct()
                        ),
                row.forecastEndDate(),
                row.blockerCount(),
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
                                row.currentRiskScore()
                        ),
                mathService
                        .bounded(
                                row.recoveryScore()
                        ),
                mathService
                        .bounded(
                                row.effectivenessPct()
                        ),
                row.recoveryHealth(),
                row.checkpointNote(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private RecoveryEscalationResponse escalationResponse(
            StrategyRecoveryRepository.EscalationRow row
    ) {
        return new RecoveryEscalationResponse(
                row.id(),
                row.recoveryCaseId(),
                row.escalationLevel(),
                row.reason(),
                row.escalatedByName(),
                row.escalatedAt()
        );
    }

    private RecoveryReviewSummaryResponse reviewSummary(
            StrategyRecoveryRepository.ReviewRow row
    ) {
        return new RecoveryReviewSummaryResponse(
                row.id(),
                row.reviewNumber(),
                row.openCaseCount(),
                row.inRecoveryCaseCount(),
                row.readyForVerificationCount(),
                row.verifiedCaseCount(),
                row.criticalCaseCount(),
                row.overdueActionCount(),
                row.escalationCount(),
                mathService
                        .decimal(
                                row.totalBaselineValueAtRiskPoints()
                        ),
                mathService
                        .decimal(
                                row.totalCurrentValueAtRiskPoints()
                        ),
                mathService
                        .bounded(
                                row.averageEffectivenessPct()
                        ),
                mathService
                        .bounded(
                                row.averageRecoveryScore()
                        ),
                row.portfolioHealth(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private boolean recoverable(
            ExecutionCommitmentResponse commitment
    ) {
        if (
                commitment.status()
                        == ExecutionCommitmentStatus.CANCELLED
        ) {
            return false;
        }

        if (
                commitment.health()
                        == ExecutionCommitmentHealth.BLOCKED
                ||
                commitment.health()
                        == ExecutionCommitmentHealth.OVERDUE
                ||
                commitment.health()
                        == ExecutionCommitmentHealth.AT_RISK
                ||
                commitment.health()
                        == ExecutionCommitmentHealth.WATCH
        ) {
            return true;
        }

        return commitment
                .valueAtRiskPoints()
                .compareTo(
                        BigDecimal.ZERO
                )
                > 0;
    }

    private boolean verificationEligible(
            ExecutionCommitmentResponse commitment
    ) {
        if (
                commitment.status()
                        == ExecutionCommitmentStatus.CANCELLED
        ) {
            return false;
        }

        boolean acceptableHealth =
                commitment.health()
                        == ExecutionCommitmentHealth.ON_TRACK
                ||
                commitment.health()
                        == ExecutionCommitmentHealth.COMPLETED;

        if (!acceptableHealth) {
            return false;
        }

        if (
                commitment.blockerCount()
                        > 0
        ) {
            return false;
        }

        if (
                commitment.status()
                        != ExecutionCommitmentStatus.COMPLETED
                &&
                commitment.forecastEndDate()
                        .isAfter(
                                commitment.plannedEndDate()
                        )
        ) {
            return false;
        }

        BigDecimal permittedValueAtRisk =
                commitment
                        .plannedContributionPoints()
                        .multiply(
                                new BigDecimal(
                                        "0.10"
                                )
                        )
                        .max(
                                new BigDecimal(
                                        "0.50"
                                )
                        );

        return commitment
                .valueAtRiskPoints()
                .compareTo(
                        permittedValueAtRisk
                )
                <= 0;
    }

    private BigDecimal riskScore(
            ExecutionCommitmentResponse commitment
    ) {
        return mathService
                .riskScore(
                        commitment.health(),
                        commitment.blockerCount(),
                        commitment.plannedContributionPoints(),
                        commitment.valueAtRiskPoints()
                );
    }

    private boolean actionOverdue(
            StrategyRecoveryRepository.ActionRow action
    ) {
        return (
                action.status()
                        == RecoveryActionStatus.PLANNED
                ||
                action.status()
                        == RecoveryActionStatus.IN_PROGRESS
        )
                &&
                action
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

    private StrategyRecoveryRepository.CaseRow requireCase(
            UUID caseId
    ) {
        StrategyRecoveryRepository.CaseRow recoveryCase =
                repository
                        .findCase(
                                caseId
                        );

        if (recoveryCase == null) {
            throw new ResourceNotFoundException(
                    "Strategy recovery case not found: "
                            + caseId
            );
        }

        return recoveryCase;
    }

    private StrategyRecoveryRepository.ActionRow requireAction(
            UUID actionId
    ) {
        StrategyRecoveryRepository.ActionRow action =
                repository
                        .findAction(
                                actionId
                        );

        if (action == null) {
            throw new ResourceNotFoundException(
                    "Strategy recovery action not found: "
                            + actionId
            );
        }

        return action;
    }

    private void requireMutableCase(
            StrategyRecoveryRepository.CaseRow recoveryCase
    ) {
        if (
                recoveryCase.status()
                        == RecoveryCaseStatus.READY_FOR_VERIFICATION
                ||
                recoveryCase.status()
                        == RecoveryCaseStatus.VERIFIED
                ||
                recoveryCase.status()
                        == RecoveryCaseStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Recovery case can no longer be structurally modified."
            );
        }
    }

    private AppUserEntity requireRecoveryUser(
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
                    "Requester accounts cannot own strategic recovery work."
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

    private String nextRecoveryNumber() {
        return String.format(
                "REC-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextRecoverySequence()
        );
    }

    private String nextReviewNumber() {
        return String.format(
                "RECRVW-%d-%05d",
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
                    "Your ProcureIQ role cannot access strategic recovery governance."
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
                    "Your ProcureIQ role cannot manage strategic recovery governance."
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
                    "Only administrators and procurement managers can verify, escalate, or close strategic recovery cases."
            );
        }
    }
}
