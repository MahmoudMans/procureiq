package com.procureiq.interventionexecution;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.fundingexecution.FundingCommitmentResponse;
import com.procureiq.fundingexecution.FundingExecutionService;
import com.procureiq.investmentintervention.InvestmentInterventionAction;
import com.procureiq.investmentintervention.InvestmentInterventionCaseDetailResponse;
import com.procureiq.investmentintervention.InvestmentInterventionCaseResponse;
import com.procureiq.investmentintervention.InvestmentInterventionDashboardResponse;
import com.procureiq.investmentintervention.InvestmentInterventionDecision;
import com.procureiq.investmentintervention.InvestmentInterventionProposalResponse;
import com.procureiq.investmentintervention.InvestmentInterventionService;
import com.procureiq.investmentintervention.InvestmentInterventionStatus;
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
public class InterventionExecutionService {

    private final InterventionExecutionRepository repository;

    private final InterventionExecutionMathService mathService;

    private final InvestmentInterventionService investmentInterventionService;

    private final FundingExecutionService fundingExecutionService;

    private final AppUserRepository appUserRepository;

    public InterventionExecutionService(
            InterventionExecutionRepository repository,
            InterventionExecutionMathService mathService,
            InvestmentInterventionService investmentInterventionService,
            FundingExecutionService fundingExecutionService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.investmentInterventionService =
                investmentInterventionService;

        this.fundingExecutionService =
                fundingExecutionService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public InterventionExecutionDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<InterventionExecutionCandidateResponse> candidates =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                candidate ->
                                        repository
                                                .activeCaseForIntervention(
                                                        candidate.interventionCaseId()
                                                )
                                        == null
                        )
                        .toList();

        List<InterventionExecutionCaseResponse> cases =
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

        return new InterventionExecutionDashboardResponse(
                summary(
                        candidates.size(),
                        cases
                ),
                repository.users(),
                candidates,
                cases,
                repository
                        .snapshots()
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public InterventionExecutionCaseDetailResponse createCase(
            UUID currentUserId,
            UUID interventionCaseId,
            InterventionExecutionCaseInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .activeCaseForIntervention(
                                interventionCaseId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "An active execution case already exists for this approved intervention."
            );
        }

        InterventionExecutionCandidateResponse candidate =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                source ->
                                        source
                                                .interventionCaseId()
                                                .equals(
                                                        interventionCaseId
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Intervention is not currently eligible for execution."
                                        )
                        );

        if (
                candidate.approvedAction()
                        != InvestmentInterventionAction.CONTINUE
                &&
                candidate
                        .approvedAffectedCapitalAmount()
                        .compareTo(
                                candidate.currentRemainingCommitmentAmount()
                        )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Approved intervention now exceeds current unreleased Step 58 committed capital."
            );
        }

        AppUserEntity owner =
                requireExecutionUser(
                        input.executionOwnerUserId()
                );

        UUID executionCaseId =
                UUID.randomUUID();

        repository.createCase(
                executionCaseId,
                nextCaseNumber(),
                candidate,
                input,
                owner.getFullName(),
                currentUserId
        );

        return executionCase(
                currentUserId,
                executionCaseId
        );
    }

    @Transactional(readOnly = true)
    public InterventionExecutionCaseDetailResponse executionCase(
            UUID currentUserId,
            UUID executionCaseId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InterventionExecutionRepository.CaseRow executionCase =
                requireCase(
                        executionCaseId
                );

        InterventionExecutionRepository.AcknowledgementRow acknowledgement =
                repository
                        .acknowledgement(
                                executionCaseId
                        );

        return new InterventionExecutionCaseDetailResponse(
                caseResponse(
                        currentUserId,
                        executionCase
                ),
                repository.users(),
                acknowledgement == null
                        ? null
                        : acknowledgementResponse(
                                acknowledgement
                        ),
                repository
                        .evidence(
                                executionCaseId
                        )
                        .stream()
                        .map(
                                this::evidenceResponse
                        )
                        .toList(),
                repository
                        .verifications(
                                executionCaseId
                        )
                        .stream()
                        .map(
                                this::verificationResponse
                        )
                        .toList()
        );
    }

    public InterventionExecutionCaseDetailResponse acknowledge(
            UUID currentUserId,
            UUID executionCaseId,
            InterventionExecutionAcknowledgementInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InterventionExecutionRepository.CaseRow executionCase =
                requireCase(
                        executionCaseId
                );

        if (
                executionCase.status()
                        != InterventionExecutionStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Execution acknowledgement can be recorded only while the case is PLANNED."
            );
        }

        if (
                repository
                        .acknowledgement(
                                executionCaseId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "Execution case already has an immutable acknowledgement."
            );
        }

        validateCurrentAuthority(
                currentUserId,
                executionCase
        );

        repository.createAcknowledgement(
                UUID.randomUUID(),
                executionCaseId,
                input,
                currentUserId
        );

        return executionCase(
                currentUserId,
                executionCaseId
        );
    }

    public InterventionExecutionCaseDetailResponse startExecution(
            UUID currentUserId,
            UUID executionCaseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InterventionExecutionRepository.CaseRow executionCase =
                requireCase(
                        executionCaseId
                );

        if (
                executionCase.status()
                        != InterventionExecutionStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only a PLANNED execution case can be started."
            );
        }

        if (
                repository
                        .acknowledgement(
                                executionCaseId
                        )
                == null
        ) {
            throw new IllegalArgumentException(
                    "Execution acknowledgement is required before implementation starts."
            );
        }

        validateCurrentAuthority(
                currentUserId,
                executionCase
        );

        repository.markActive(
                executionCaseId
        );

        return executionCase(
                currentUserId,
                executionCaseId
        );
    }

    public InterventionExecutionCaseDetailResponse recordEvidence(
            UUID currentUserId,
            UUID executionCaseId,
            InterventionExecutionEvidenceInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InterventionExecutionRepository.CaseRow executionCase =
                requireCase(
                        executionCaseId
                );

        if (
                executionCase.status()
                        != InterventionExecutionStatus.ACTIVE
                &&
                executionCase.status()
                        != InterventionExecutionStatus.REMEDIATION_REQUIRED
        ) {
            throw new IllegalArgumentException(
                    "Implementation evidence can be recorded only while execution is ACTIVE or REMEDIATION_REQUIRED."
            );
        }

        if (
                input.implementedOn()
                        .isAfter(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Implementation evidence cannot use a future date."
            );
        }

        BigDecimal amount =
                mathService.money(
                        input.implementedCapitalAmount()
                );

        List<BigDecimal> existing =
                repository
                        .evidence(
                                executionCaseId
                        )
                        .stream()
                        .map(
                                InterventionExecutionRepository.EvidenceRow::
                                        implementedCapitalAmount
                        )
                        .toList();

        if (
                executionCase.approvedAction()
                        == InvestmentInterventionAction.CONTINUE
        ) {
            if (
                    amount.compareTo(
                            BigDecimal.ZERO
                    )
                    != 0
            ) {
                throw new IllegalArgumentException(
                    "CONTINUE implementation evidence must use zero affected capital."
                );
            }
        } else {
            if (
                    amount.compareTo(
                            BigDecimal.ZERO
                    )
                    <= 0
            ) {
                throw new IllegalArgumentException(
                    "Capital-affecting intervention evidence requires a positive implemented amount."
                );
            }

            BigDecimal currentImplemented =
                    existing.stream()
                            .map(
                                    mathService::money
                            )
                            .reduce(
                                    BigDecimal.ZERO,
                                    BigDecimal::add
                            );

            BigDecimal resultingImplemented =
                    currentImplemented
                            .add(
                                    amount
                            );

            if (
                    resultingImplemented.compareTo(
                            mathService.money(
                                    executionCase.approvedAffectedCapitalAmount()
                            )
                    )
                    > 0
            ) {
                throw new IllegalArgumentException(
                        "Cumulative implemented capital cannot exceed the approved Step 60 intervention amount."
                );
            }

            FundingCommitmentResponse funding =
                    currentFundingCommitment(
                            currentUserId,
                            executionCase.fundingCommitmentId()
                    );

            if (
                    resultingImplemented.compareTo(
                            mathService.money(
                                    funding.remainingCommitmentAmount()
                            )
                    )
                    > 0
            ) {
                throw new IllegalArgumentException(
                        "Cumulative implementation now exceeds current unreleased Step 58 committed capital."
                );
            }
        }

        repository.createEvidence(
                UUID.randomUUID(),
                executionCaseId,
                input,
                currentUserId
        );

        return executionCase(
                currentUserId,
                executionCaseId
        );
    }

    public InterventionExecutionCaseDetailResponse submitForVerification(
            UUID currentUserId,
            UUID executionCaseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InterventionExecutionRepository.CaseRow executionCase =
                requireCase(
                        executionCaseId
                );

        if (
                executionCase.status()
                        != InterventionExecutionStatus.ACTIVE
                &&
                executionCase.status()
                        != InterventionExecutionStatus.REMEDIATION_REQUIRED
        ) {
            throw new IllegalArgumentException(
                    "Only ACTIVE or REMEDIATION_REQUIRED execution cases can be submitted for verification."
            );
        }

        if (
                repository
                        .acknowledgement(
                                executionCaseId
                        )
                == null
        ) {
            throw new IllegalArgumentException(
                    "Execution acknowledgement is required."
            );
        }

        if (
                repository
                        .evidence(
                                executionCaseId
                        )
                        .isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "At least one immutable implementation-evidence record is required before verification."
            );
        }

        validateCurrentAuthority(
                currentUserId,
                executionCase
        );

        repository.markReadyForVerification(
                executionCaseId
        );

        return executionCase(
                currentUserId,
                executionCaseId
        );
    }

    public InterventionExecutionCaseDetailResponse verifyExecution(
            UUID currentUserId,
            UUID executionCaseId,
            InterventionExecutionVerificationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InterventionExecutionRepository.CaseRow executionCase =
                requireCase(
                        executionCaseId
                );

        if (
                executionCase.status()
                        != InterventionExecutionStatus.READY_FOR_VERIFICATION
        ) {
            throw new IllegalArgumentException(
                    "Execution case is not READY_FOR_VERIFICATION."
            );
        }

        InterventionExecutionMetricResult metric =
                metrics(
                        executionCase
                );

        if (
                input.decision()
                        == InterventionExecutionVerificationDecision.VERIFIED
                &&
                metric.implementationPct()
                        .compareTo(
                                new BigDecimal(
                                        "100.00"
                                )
                        )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Execution cannot be VERIFIED while approved intervention implementation remains incomplete."
            );
        }

        validateCurrentAuthority(
                currentUserId,
                executionCase
        );

        repository.createVerification(
                UUID.randomUUID(),
                executionCaseId,
                input,
                executionCase.approvedAction(),
                metric,
                currentUserId
        );

        if (
                input.decision()
                        == InterventionExecutionVerificationDecision.VERIFIED
        ) {
            repository.markVerified(
                    executionCaseId
            );
        } else {
            repository.markRemediationRequired(
                    executionCaseId
            );
        }

        InterventionExecutionCaseDetailResponse result =
                executionCase(
                        currentUserId,
                        executionCaseId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public InterventionExecutionCaseDetailResponse closeCase(
            UUID currentUserId,
            UUID executionCaseId,
            InterventionExecutionNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InterventionExecutionRepository.CaseRow executionCase =
                requireCase(
                        executionCaseId
                );

        if (
                executionCase.status()
                        != InterventionExecutionStatus.VERIFIED
        ) {
            throw new IllegalArgumentException(
                    "Only a VERIFIED execution case can be closed."
            );
        }

        repository.closeCase(
                executionCaseId,
                input.note(),
                currentUserId
        );

        InterventionExecutionCaseDetailResponse result =
                executionCase(
                        currentUserId,
                        executionCaseId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public InterventionExecutionSnapshotDetailResponse captureSnapshot(
            UUID currentUserId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return captureSnapshotInternal(
                currentUserId
        );
    }

    @Transactional(readOnly = true)
    public InterventionExecutionSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InterventionExecutionRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Intervention-execution snapshot not found: "
                            + snapshotId
            );
        }

        return new InterventionExecutionSnapshotDetailResponse(
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

    private InterventionExecutionSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId
    ) {
        List<InterventionExecutionCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .filter(
                                executionCase ->
                                        executionCase.status()
                                                != InterventionExecutionStatus.CLOSED
                        )
                        .map(
                                row ->
                                        caseResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        InterventionExecutionSummaryResponse summary =
                summary(
                        0,
                        cases
                );

        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                summary,
                currentUserId
        );

        for (
                InterventionExecutionCaseResponse executionCase
                : cases
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    executionCase
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<InterventionExecutionCandidateResponse> sourceCandidates(
            UUID currentUserId
    ) {
        InvestmentInterventionDashboardResponse interventionDashboard =
                investmentInterventionService
                        .dashboard(
                                currentUserId
                        );

        return interventionDashboard
                .cases()
                .stream()
                .filter(
                        interventionCase ->
                                interventionCase.status()
                                        == InvestmentInterventionStatus.APPROVED
                                ||
                                interventionCase.status()
                                        == InvestmentInterventionStatus.CLOSED
                )
                .filter(
                        interventionCase ->
                                interventionCase.approvedAction()
                                        != null
                )
                .map(
                        interventionCase ->
                                candidateResponse(
                                        currentUserId,
                                        interventionCase
                                )
                )
                .toList();
    }

    private InterventionExecutionCandidateResponse candidateResponse(
            UUID currentUserId,
            InvestmentInterventionCaseResponse interventionCase
    ) {
        InvestmentInterventionCaseDetailResponse detail =
                investmentInterventionService
                        .interventionCase(
                                currentUserId,
                                interventionCase.id()
                        );

        InvestmentInterventionProposalResponse approvedProposal =
                detail
                        .proposals()
                        .stream()
                        .filter(
                                proposal ->
                                        proposal.decision()
                                                != null
                                        &&
                                        proposal.decision()
                                                .decision()
                                                == InvestmentInterventionDecision.APPROVED
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "Approved Step 60 intervention is missing its immutable approved proposal."
                                        )
                        );

        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        interventionCase.fundingCommitmentId()
                );

        return new InterventionExecutionCandidateResponse(
                interventionCase.id(),
                interventionCase.interventionNumber(),
                interventionCase.status(),

                interventionCase.performanceCaseId(),
                interventionCase.performanceCaseNumber(),
                interventionCase.currentPerformanceHealth(),

                interventionCase.fundingCommitmentId(),
                interventionCase.fundingCommitmentNumber(),

                interventionCase.valueCaseId(),
                interventionCase.valueCaseNumber(),

                interventionCase.initiativeNumber(),
                interventionCase.initiativeTitle(),
                interventionCase.currency(),
                interventionCase.fiscalYear(),

                approvedProposal.actionType(),
                mathService.money(
                        approvedProposal.affectedCapitalAmount()
                ),

                approvedProposal.targetValueCaseId(),
                approvedProposal.targetValueCaseNumber(),
                approvedProposal.targetInitiativeTitle(),

                mathService.money(
                        funding.releasedAmount()
                ),
                mathService.money(
                        funding.remainingCommitmentAmount()
                )
        );
    }

    private InterventionExecutionCaseResponse caseResponse(
            UUID currentUserId,
            InterventionExecutionRepository.CaseRow row
    ) {
        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        row.fundingCommitmentId()
                );

        InterventionExecutionMetricResult metric =
                metrics(
                        row
                );

        return new InterventionExecutionCaseResponse(
                row.id(),
                row.executionNumber(),

                row.interventionCaseId(),
                row.interventionNumber(),

                row.performanceCaseId(),
                row.performanceCaseNumber(),

                row.fundingCommitmentId(),
                row.fundingCommitmentNumber(),

                row.sourceValueCaseId(),
                row.sourceValueCaseNumber(),

                row.initiativeNumber(),
                row.initiativeTitle(),
                row.currency(),
                row.fiscalYear(),

                row.approvedAction(),
                mathService.money(
                        row.approvedAffectedCapitalAmount()
                ),

                row.approvedTargetValueCaseId(),
                row.approvedTargetValueCaseNumber(),
                row.approvedTargetInitiativeTitle(),

                mathService.money(
                        row.sourceReleasedCapitalSnapshot()
                ),
                mathService.money(
                        row.sourceRemainingCommitmentSnapshot()
                ),

                mathService.money(
                        funding.releasedAmount()
                ),
                mathService.money(
                        funding.remainingCommitmentAmount()
                ),

                row.executionOwnerUserId(),
                row.executionOwnerName(),
                row.executionObjective(),

                metric.implementedCapitalAmount(),
                metric.remainingImplementationAmount(),
                metric.implementationPct(),
                metric.implementationVarianceAmount(),
                metric.health(),

                row.status(),

                repository
                        .acknowledgement(
                                row.id()
                        )
                        != null,

                repository
                        .evidence(
                                row.id()
                        )
                        .size(),

                repository
                        .verifications(
                                row.id()
                        )
                        .size(),

                row.closeNote(),
                row.closedByName(),
                row.closedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private InterventionExecutionMetricResult metrics(
            InterventionExecutionRepository.CaseRow executionCase
    ) {
        return mathService
                .metrics(
                        executionCase.approvedAction(),
                        executionCase.approvedAffectedCapitalAmount(),
                        repository
                                .evidence(
                                        executionCase.id()
                                )
                                .stream()
                                .map(
                                        InterventionExecutionRepository.EvidenceRow::
                                                implementedCapitalAmount
                                )
                                .toList(),
                        executionCase.status()
                );
    }

    private InterventionExecutionAcknowledgementResponse acknowledgementResponse(
            InterventionExecutionRepository.AcknowledgementRow row
    ) {
        return new InterventionExecutionAcknowledgementResponse(
                row.id(),
                row.executionCaseId(),
                row.acknowledgementNote(),
                row.acknowledgedByName(),
                row.acknowledgedAt()
        );
    }

    private InterventionExecutionEvidenceResponse evidenceResponse(
            InterventionExecutionRepository.EvidenceRow row
    ) {
        return new InterventionExecutionEvidenceResponse(
                row.id(),
                row.executionCaseId(),
                row.implementedOn(),
                mathService.money(
                        row.implementedCapitalAmount()
                ),
                row.evidenceNote(),
                row.referenceText(),
                row.recordedByName(),
                row.recordedAt()
        );
    }

    private InterventionExecutionVerificationResponse verificationResponse(
            InterventionExecutionRepository.VerificationRow row
    ) {
        return new InterventionExecutionVerificationResponse(
                row.id(),
                row.executionCaseId(),
                row.decision(),
                row.approvedAction(),
                mathService.money(
                        row.approvedAffectedCapitalAmount()
                ),
                mathService.money(
                        row.implementedCapitalAmount()
                ),
                mathService.money(
                        row.remainingImplementationAmount()
                ),
                mathService.percent(
                        row.implementationPct()
                ),
                mathService.money(
                        row.implementationVarianceAmount()
                ),
                row.verificationNote(),
                row.verifiedByName(),
                row.verifiedAt()
        );
    }

    private InterventionExecutionSummaryResponse summary(
            int candidateCount,
            List<InterventionExecutionCaseResponse> cases
    ) {
        List<InterventionExecutionCaseResponse> active =
                cases.stream()
                        .filter(
                                executionCase ->
                                        executionCase.status()
                                                != InterventionExecutionStatus.CLOSED
                        )
                        .toList();

        return new InterventionExecutionSummaryResponse(
                candidateCount,
                active.size(),

                countStatus(
                        active,
                        InterventionExecutionStatus.PLANNED
                ),

                countStatus(
                        active,
                        InterventionExecutionStatus.ACTIVE
                ),

                countStatus(
                        active,
                        InterventionExecutionStatus.READY_FOR_VERIFICATION
                ),

                countStatus(
                        active,
                        InterventionExecutionStatus.VERIFIED
                ),

                countStatus(
                        active,
                        InterventionExecutionStatus.REMEDIATION_REQUIRED
                ),

                sum(
                        active.stream()
                                .map(
                                        InterventionExecutionCaseResponse::
                                                approvedAffectedCapitalAmount
                                )
                                .toList()
                ),

                sum(
                        active.stream()
                                .map(
                                        InterventionExecutionCaseResponse::
                                                implementedCapitalAmount
                                )
                                .toList()
                ),

                sum(
                        active.stream()
                                .map(
                                        InterventionExecutionCaseResponse::
                                                remainingImplementationAmount
                                )
                                .toList()
                ),

                mathService.averagePct(
                        active.stream()
                                .map(
                                        InterventionExecutionCaseResponse::
                                                implementationPct
                                )
                                .toList()
                )
        );
    }

    private InterventionExecutionSnapshotSummaryResponse snapshotSummary(
            InterventionExecutionRepository.SnapshotRow row
    ) {
        return new InterventionExecutionSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.caseCount(),
                row.plannedCaseCount(),
                row.activeCaseCount(),
                row.readyCaseCount(),
                row.verifiedCaseCount(),
                row.remediationCaseCount(),
                mathService.money(
                        row.totalApprovedAffectedCapitalAmount()
                ),
                mathService.money(
                        row.totalImplementedCapitalAmount()
                ),
                mathService.money(
                        row.totalRemainingImplementationAmount()
                ),
                mathService.percent(
                        row.averageImplementationPct()
                ),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private InterventionExecutionSnapshotItemResponse snapshotItemResponse(
            InterventionExecutionRepository.SnapshotItemRow row
    ) {
        return new InterventionExecutionSnapshotItemResponse(
                row.executionCaseId(),
                row.executionNumber(),
                row.interventionNumber(),
                row.initiativeTitle(),
                row.currency(),
                row.caseStatus(),
                row.approvedAction(),
                mathService.money(
                        row.approvedAffectedCapitalAmount()
                ),
                mathService.money(
                        row.implementedCapitalAmount()
                ),
                mathService.money(
                        row.remainingImplementationAmount()
                ),
                mathService.percent(
                        row.implementationPct()
                ),
                mathService.money(
                        row.implementationVarianceAmount()
                ),
                row.executionHealth(),
                mathService.money(
                        row.currentReleasedCapitalAmount()
                ),
                mathService.money(
                        row.currentRemainingCommitmentAmount()
                ),
                row.approvedTargetValueCaseNumber()
        );
    }

    private void validateCurrentAuthority(
            UUID currentUserId,
            InterventionExecutionRepository.CaseRow executionCase
    ) {
        InvestmentInterventionCaseResponse interventionCase =
                investmentInterventionService
                        .interventionCase(
                                currentUserId,
                                executionCase.interventionCaseId()
                        )
                        .interventionCase();

        if (
                interventionCase.status()
                        != InvestmentInterventionStatus.APPROVED
                &&
                interventionCase.status()
                        != InvestmentInterventionStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Step 60 intervention is no longer an approved execution authority."
            );
        }

        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        executionCase.fundingCommitmentId()
                );

        if (
                executionCase.approvedAction()
                        != InvestmentInterventionAction.CONTINUE
                &&
                mathService.money(
                        executionCase.approvedAffectedCapitalAmount()
                )
                        .compareTo(
                                mathService.money(
                                        funding.remainingCommitmentAmount()
                                )
                        )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Approved Step 60 capital intervention now exceeds current unreleased Step 58 committed capital."
            );
        }
    }

    private FundingCommitmentResponse currentFundingCommitment(
            UUID currentUserId,
            UUID fundingCommitmentId
    ) {
        return fundingExecutionService
                .commitment(
                        currentUserId,
                        fundingCommitmentId
                )
                .commitment();
    }

    private InterventionExecutionRepository.CaseRow requireCase(
            UUID executionCaseId
    ) {
        InterventionExecutionRepository.CaseRow executionCase =
                repository
                        .findCase(
                                executionCaseId
                        );

        if (executionCase == null) {
            throw new ResourceNotFoundException(
                    "Intervention-execution case not found: "
                            + executionCaseId
            );
        }

        return executionCase;
    }

    private AppUserEntity requireExecutionUser(
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
                    "Requester accounts cannot own approved intervention execution."
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

    private int countStatus(
            List<InterventionExecutionCaseResponse> cases,
            InterventionExecutionStatus status
    ) {
        return (
                int
        ) cases.stream()
                .filter(
                        executionCase ->
                                executionCase.status()
                                        == status
                )
                .count();
    }

    private BigDecimal sum(
            List<BigDecimal> values
    ) {
        return values.stream()
                .map(
                        mathService::money
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private String nextCaseNumber() {
        return String.format(
                "INTEXEC-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextCaseSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "INTEXSNAP-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextSnapshotSequence()
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
                    "Your ProcureIQ role cannot access approved intervention execution."
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
                    "Your ProcureIQ role cannot manage approved intervention execution."
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
                    "Only administrators and procurement managers can verify intervention execution."
            );
        }
    }
}
