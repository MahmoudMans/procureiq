package com.procureiq.capitalredeployment;

import com.procureiq.capitalrecycling.CapitalRecyclingDashboardResponse;
import com.procureiq.capitalrecycling.CapitalRecyclingService;
import com.procureiq.capitalrecycling.CapitalRecyclingSourceDetailResponse;
import com.procureiq.capitalrecycling.CapitalRecyclingSourceResponse;
import com.procureiq.capitalrecycling.CapitalReinvestmentDecision;
import com.procureiq.capitalrecycling.CapitalReinvestmentProposalResponse;
import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.fundingexecution.FundingCommitmentResponse;
import com.procureiq.fundingexecution.FundingExecutionService;
import com.procureiq.strategicvalue.StrategicValueCaseResponse;
import com.procureiq.strategicvalue.StrategicValueCaseStatus;
import com.procureiq.strategicvalue.StrategicValueHealth;
import com.procureiq.strategicvalue.StrategicValueService;
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
public class CapitalRedeploymentService {

    private final CapitalRedeploymentRepository repository;

    private final CapitalRedeploymentMathService mathService;

    private final CapitalRecyclingService capitalRecyclingService;

    private final FundingExecutionService fundingExecutionService;

    private final StrategicValueService strategicValueService;

    private final AppUserRepository appUserRepository;

    public CapitalRedeploymentService(
            CapitalRedeploymentRepository repository,
            CapitalRedeploymentMathService mathService,
            CapitalRecyclingService capitalRecyclingService,
            FundingExecutionService fundingExecutionService,
            StrategicValueService strategicValueService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.capitalRecyclingService =
                capitalRecyclingService;

        this.fundingExecutionService =
                fundingExecutionService;

        this.strategicValueService =
                strategicValueService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public CapitalRedeploymentDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<CapitalRedeploymentCandidateResponse> candidates =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                candidate ->
                                        repository
                                                .caseForProposal(
                                                        candidate.reinvestmentProposalId()
                                                )
                                        == null
                        )
                        .toList();

        List<CapitalRedeploymentCaseResponse> cases =
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

        return new CapitalRedeploymentDashboardResponse(
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

    public CapitalRedeploymentCaseDetailResponse createCase(
            UUID currentUserId,
            UUID reinvestmentProposalId,
            CapitalRedeploymentCaseInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .caseForProposal(
                                reinvestmentProposalId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "A capital-redeployment case already exists for this approved Step 62 proposal."
            );
        }

        CapitalRedeploymentCandidateResponse candidate =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                source ->
                                        source
                                                .reinvestmentProposalId()
                                                .equals(
                                                        reinvestmentProposalId
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Step 62 reinvestment proposal is not currently eligible for redeployment."
                                        )
                        );

        validateCandidateCapitalSafety(
                candidate
        );

        validateTarget(
                currentUserId,
                candidate.targetValueCaseId(),
                candidate.currency(),
                candidate.fiscalYear()
        );

        AppUserEntity owner =
                requireRedeploymentUser(
                        input.redeploymentOwnerUserId()
                );

        UUID caseId =
                UUID.randomUUID();

        repository.createCase(
                caseId,
                nextCaseNumber(),
                candidate,
                input,
                owner.getFullName(),
                currentUserId
        );

        return redeploymentCase(
                currentUserId,
                caseId
        );
    }

    @Transactional(readOnly = true)
    public CapitalRedeploymentCaseDetailResponse redeploymentCase(
            UUID currentUserId,
            UUID caseId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRedeploymentRepository.CaseRow redeploymentCase =
                requireCase(
                        caseId
                );

        return new CapitalRedeploymentCaseDetailResponse(
                caseResponse(
                        currentUserId,
                        redeploymentCase
                ),
                repository.users(),
                repository
                        .gates(
                                caseId
                        )
                        .stream()
                        .map(
                                this::gateResponse
                        )
                        .toList(),
                repository
                        .authorizations(
                                caseId
                        )
                        .stream()
                        .map(
                                this::authorizationResponse
                        )
                        .toList(),
                repository
                        .releases(
                                caseId
                        )
                        .stream()
                        .map(
                                this::releaseResponse
                        )
                        .toList(),
                repository
                        .verifications(
                                caseId
                        )
                        .stream()
                        .map(
                                this::verificationResponse
                        )
                        .toList()
        );
    }

    public CapitalRedeploymentCaseDetailResponse createGate(
            UUID currentUserId,
            UUID caseId,
            CapitalRedeploymentGateInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRedeploymentRepository.CaseRow redeploymentCase =
                requireCase(
                        caseId
                );

        if (
                redeploymentCase.status()
                        != CapitalRedeploymentStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Redeployment gates can be created only while the case is PLANNED."
            );
        }

        repository.createGate(
                UUID.randomUUID(),
                nextGateNumber(),
                caseId,
                input,
                currentUserId
        );

        return redeploymentCase(
                currentUserId,
                caseId
        );
    }

    public CapitalRedeploymentCaseDetailResponse decideGate(
            UUID currentUserId,
            UUID gateId,
            CapitalRedeploymentGateDecisionInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                input.decision()
                        == CapitalRedeploymentGateStatus.PENDING
        ) {
            throw new IllegalArgumentException(
                    "Redeployment gate decision must be SATISFIED or WAIVED."
            );
        }

        CapitalRedeploymentRepository.GateRow gate =
                requireGate(
                        gateId
                );

        if (
                gate.status()
                        != CapitalRedeploymentGateStatus.PENDING
        ) {
            throw new IllegalArgumentException(
                    "Redeployment gate already has a final decision."
            );
        }

        CapitalRedeploymentRepository.CaseRow redeploymentCase =
                requireCase(
                        gate.redeploymentCaseId()
                );

        if (
                redeploymentCase.status()
                        != CapitalRedeploymentStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Redeployment gates can be decided only while the case is PLANNED."
            );
        }

        repository.decideGate(
                gateId,
                input,
                currentUserId
        );

        return redeploymentCase(
                currentUserId,
                redeploymentCase.id()
        );
    }

    public CapitalRedeploymentCaseDetailResponse submitForAuthorization(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRedeploymentRepository.CaseRow redeploymentCase =
                requireCase(
                        caseId
                );

        if (
                redeploymentCase.status()
                        != CapitalRedeploymentStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only a PLANNED redeployment case can request authorization."
            );
        }

        List<CapitalRedeploymentRepository.GateRow> gates =
                repository
                        .gates(
                                caseId
                        );

        if (gates.isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one evidence gate is required before redeployment authorization."
            );
        }

        if (
                gates.stream()
                        .anyMatch(
                                gate ->
                                        gate.status()
                                                == CapitalRedeploymentGateStatus.PENDING
                        )
        ) {
            throw new IllegalArgumentException(
                    "All redeployment gates must be satisfied or waived before authorization."
            );
        }

        validateCurrentAuthority(
                currentUserId,
                redeploymentCase
        );

        repository.markReadyForAuthorization(
                caseId
        );

        return redeploymentCase(
                currentUserId,
                caseId
        );
    }

    public CapitalRedeploymentCaseDetailResponse authorize(
            UUID currentUserId,
            UUID caseId,
            CapitalRedeploymentAuthorizationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRedeploymentRepository.CaseRow redeploymentCase =
                requireCase(
                        caseId
                );

        if (
                redeploymentCase.status()
                        != CapitalRedeploymentStatus.READY_FOR_AUTHORIZATION
        ) {
            throw new IllegalArgumentException(
                    "Redeployment case is not READY_FOR_AUTHORIZATION."
            );
        }

        if (
                input.decision()
                        == CapitalRedeploymentAuthorizationDecision.APPROVED
        ) {
            validateCurrentAuthority(
                    currentUserId,
                    redeploymentCase
            );
        }

        repository.createAuthorization(
                UUID.randomUUID(),
                caseId,
                redeploymentCase.approvedRedeploymentAmount(),
                input,
                currentUserId
        );

        if (
                input.decision()
                        == CapitalRedeploymentAuthorizationDecision.APPROVED
        ) {
            repository.markAuthorized(
                    caseId
            );
        } else {
            repository.returnToPlanned(
                    caseId
            );
        }

        return redeploymentCase(
                currentUserId,
                caseId
        );
    }

    public CapitalRedeploymentCaseDetailResponse activate(
            UUID currentUserId,
            UUID caseId
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRedeploymentRepository.CaseRow redeploymentCase =
                requireCase(
                        caseId
                );

        if (
                redeploymentCase.status()
                        != CapitalRedeploymentStatus.AUTHORIZED
        ) {
            throw new IllegalArgumentException(
                    "Only an AUTHORIZED redeployment case can become ACTIVE."
            );
        }

        if (
                repository
                        .latestApprovedAuthorization(
                                caseId
                        )
                == null
        ) {
            throw new IllegalArgumentException(
                    "Redeployment case does not contain an approved authorization."
            );
        }

        validateCurrentAuthority(
                currentUserId,
                redeploymentCase
        );

        repository.markActive(
                caseId
        );

        return redeploymentCase(
                currentUserId,
                caseId
        );
    }

    public CapitalRedeploymentCaseDetailResponse recordRelease(
            UUID currentUserId,
            UUID caseId,
            CapitalRedeploymentReleaseInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRedeploymentRepository.CaseRow redeploymentCase =
                requireCase(
                        caseId
                );

        if (
                redeploymentCase.status()
                        != CapitalRedeploymentStatus.ACTIVE
                &&
                redeploymentCase.status()
                        != CapitalRedeploymentStatus.REMEDIATION_REQUIRED
        ) {
            throw new IllegalArgumentException(
                    "Redeployment release evidence can be recorded only while ACTIVE or REMEDIATION_REQUIRED."
            );
        }

        if (
                input.releasedOn()
                        .isAfter(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Redeployment release date cannot be in the future."
            );
        }

        CapitalRedeploymentRepository.AuthorizationRow authorization =
                repository
                        .latestApprovedAuthorization(
                                caseId
                        );

        if (authorization == null) {
            throw new IllegalArgumentException(
                    "An approved redeployment authorization is required before release."
            );
        }

        BigDecimal existingReleased =
                repository
                        .releases(
                                caseId
                        )
                        .stream()
                        .map(
                                CapitalRedeploymentRepository.ReleaseRow::
                                        releasedAmount
                        )
                        .map(
                                mathService::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal resultingReleased =
                existingReleased
                        .add(
                                mathService.money(
                                        input.releasedAmount()
                                )
                        );

        BigDecimal approved =
                mathService.money(
                        redeploymentCase.approvedRedeploymentAmount()
                );

        if (
                resultingReleased.compareTo(
                        approved
                )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Cumulative redeployment releases cannot exceed the approved Step 62 reinvestment amount."
            );
        }

        FundingCommitmentResponse funding =
                currentSourceFunding(
                        currentUserId,
                        redeploymentCase.sourceFundingCommitmentId()
                );

        if (
                resultingReleased.compareTo(
                        mathService.money(
                                funding.remainingCommitmentAmount()
                        )
                )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Cumulative redeployment releases now exceed current unreleased Step 58 source capital."
            );
        }

        validateCurrentAuthority(
                currentUserId,
                redeploymentCase
        );

        repository.createRelease(
                UUID.randomUUID(),
                caseId,
                authorization.id(),
                input,
                currentUserId
        );

        return redeploymentCase(
                currentUserId,
                caseId
        );
    }

    public CapitalRedeploymentCaseDetailResponse submitForVerification(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRedeploymentRepository.CaseRow redeploymentCase =
                requireCase(
                        caseId
                );

        if (
                redeploymentCase.status()
                        != CapitalRedeploymentStatus.ACTIVE
                &&
                redeploymentCase.status()
                        != CapitalRedeploymentStatus.REMEDIATION_REQUIRED
        ) {
            throw new IllegalArgumentException(
                    "Only ACTIVE or REMEDIATION_REQUIRED redeployment cases can be submitted for verification."
            );
        }

        if (
                repository
                        .releases(
                                caseId
                        )
                        .isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "At least one immutable redeployment-release record is required before verification."
            );
        }

        validateCurrentAuthority(
                currentUserId,
                redeploymentCase
        );

        repository.markReadyForVerification(
                caseId
        );

        return redeploymentCase(
                currentUserId,
                caseId
        );
    }

    public CapitalRedeploymentCaseDetailResponse verify(
            UUID currentUserId,
            UUID caseId,
            CapitalRedeploymentVerificationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRedeploymentRepository.CaseRow redeploymentCase =
                requireCase(
                        caseId
                );

        if (
                redeploymentCase.status()
                        != CapitalRedeploymentStatus.READY_FOR_VERIFICATION
        ) {
            throw new IllegalArgumentException(
                    "Redeployment case is not READY_FOR_VERIFICATION."
            );
        }

        CapitalRedeploymentMetricResult metric =
                metrics(
                        redeploymentCase
                );

        if (
                input.decision()
                        == CapitalRedeploymentVerificationDecision.VERIFIED
                &&
                metric.redeploymentPct()
                        .compareTo(
                                new BigDecimal(
                                        "100.00"
                                )
                        )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Redeployment cannot be VERIFIED until the approved reinvestment amount is fully released."
            );
        }

        validateCurrentAuthority(
                currentUserId,
                redeploymentCase
        );

        repository.createVerification(
                UUID.randomUUID(),
                caseId,
                input,
                metric,
                currentUserId
        );

        if (
                input.decision()
                        == CapitalRedeploymentVerificationDecision.VERIFIED
        ) {
            repository.markVerified(
                    caseId
            );
        } else {
            repository.markRemediationRequired(
                    caseId
            );
        }

        CapitalRedeploymentCaseDetailResponse result =
                redeploymentCase(
                        currentUserId,
                        caseId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public CapitalRedeploymentCaseDetailResponse closeCase(
            UUID currentUserId,
            UUID caseId,
            CapitalRedeploymentNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRedeploymentRepository.CaseRow redeploymentCase =
                requireCase(
                        caseId
                );

        if (
                redeploymentCase.status()
                        != CapitalRedeploymentStatus.VERIFIED
        ) {
            throw new IllegalArgumentException(
                    "Only a VERIFIED redeployment case can be closed."
            );
        }

        repository.closeCase(
                caseId,
                input.note(),
                currentUserId
        );

        CapitalRedeploymentCaseDetailResponse result =
                redeploymentCase(
                        currentUserId,
                        caseId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public CapitalRedeploymentSnapshotDetailResponse captureSnapshot(
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
    public CapitalRedeploymentSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRedeploymentRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Capital-redeployment snapshot not found: "
                            + snapshotId
            );
        }

        return new CapitalRedeploymentSnapshotDetailResponse(
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

    private CapitalRedeploymentSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId
    ) {
        List<CapitalRedeploymentCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .filter(
                                redeploymentCase ->
                                        redeploymentCase.status()
                                                != CapitalRedeploymentStatus.CLOSED
                        )
                        .map(
                                row ->
                                        caseResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        CapitalRedeploymentSummaryResponse summary =
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
                CapitalRedeploymentCaseResponse redeploymentCase
                : cases
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    redeploymentCase
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<CapitalRedeploymentCandidateResponse> sourceCandidates(
            UUID currentUserId
    ) {
        CapitalRecyclingDashboardResponse dashboard =
                capitalRecyclingService
                        .dashboard(
                                currentUserId
                        );

        return dashboard
                .sources()
                .stream()
                .flatMap(
                        source -> {
                            CapitalRecyclingSourceDetailResponse detail =
                                    capitalRecyclingService
                                            .source(
                                                    currentUserId,
                                                    source.id()
                                            );

                            return detail
                                    .proposals()
                                    .stream()
                                    .filter(
                                            proposal ->
                                                    proposal.decision()
                                                            != null
                                                    &&
                                                    proposal.decision()
                                                            .decision()
                                                            == CapitalReinvestmentDecision.APPROVED
                                    )
                                    .map(
                                            proposal ->
                                                    candidateResponse(
                                                            currentUserId,
                                                            source,
                                                            proposal
                                                    )
                                    );
                        }
                )
                .filter(
                        candidate ->
                                candidate.approvedRedeploymentAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        )
                                > 0
                )
                .toList();
    }

    private CapitalRedeploymentCandidateResponse candidateResponse(
            UUID currentUserId,
            CapitalRecyclingSourceResponse source,
            CapitalReinvestmentProposalResponse proposal
    ) {
        FundingCommitmentResponse funding =
                currentSourceFunding(
                        currentUserId,
                        source.fundingCommitmentId()
                );

        return new CapitalRedeploymentCandidateResponse(
                source.id(),
                source.sourceNumber(),
                source.status(),

                proposal.id(),

                source.fundingCommitmentId(),
                source.fundingCommitmentNumber(),

                source.sourceValueCaseId(),
                source.sourceValueCaseNumber(),

                proposal.targetValueCaseId(),
                proposal.targetValueCaseNumber(),
                proposal.targetInitiativeNumber(),
                proposal.targetInitiativeTitle(),

                source.currency(),
                source.fiscalYear(),

                mathService.money(
                        proposal.requestedReinvestmentAmount()
                ),
                mathService.money(
                        source.recyclableCapitalAmount()
                ),
                mathService.money(
                        funding.remainingCommitmentAmount()
                ),

                proposal.targetRoiPctSnapshot(),
                proposal.targetPersistencePctSnapshot(),
                proposal.targetNetValueSnapshot(),
                proposal.targetValueHealthSnapshot()
        );
    }

    private CapitalRedeploymentCaseResponse caseResponse(
            UUID currentUserId,
            CapitalRedeploymentRepository.CaseRow row
    ) {
        CapitalRecyclingSourceResponse source =
                capitalRecyclingService
                        .source(
                                currentUserId,
                                row.recyclingSourceId()
                        )
                        .source();

        FundingCommitmentResponse funding =
                currentSourceFunding(
                        currentUserId,
                        row.sourceFundingCommitmentId()
                );

        CapitalRedeploymentMetricResult metric =
                metrics(
                        row
                );

        List<CapitalRedeploymentRepository.GateRow> gates =
                repository
                        .gates(
                                row.id()
                        );

        int resolvedGates =
                (
                        int
                ) gates.stream()
                        .filter(
                                gate ->
                                        gate.status()
                                                != CapitalRedeploymentGateStatus.PENDING
                        )
                        .count();

        int pendingGates =
                gates.size()
                        - resolvedGates;

        return new CapitalRedeploymentCaseResponse(
                row.id(),
                row.redeploymentNumber(),

                row.recyclingSourceId(),
                row.recyclingSourceNumber(),
                source.status(),

                row.reinvestmentProposalId(),

                row.sourceFundingCommitmentId(),
                row.sourceFundingCommitmentNumber(),

                row.sourceValueCaseId(),
                row.sourceValueCaseNumber(),

                row.targetValueCaseId(),
                row.targetValueCaseNumber(),
                row.targetInitiativeNumber(),
                row.targetInitiativeTitle(),

                row.currency(),
                row.fiscalYear(),

                mathService.money(
                        row.approvedRedeploymentAmount()
                ),
                mathService.money(
                        row.sourceRecyclableCapitalSnapshot()
                ),
                mathService.money(
                        row.sourceFundingRemainingSnapshot()
                ),
                mathService.money(
                        funding.remainingCommitmentAmount()
                ),

                row.targetRoiPctSnapshot(),
                row.targetPersistencePctSnapshot(),
                row.targetNetValueSnapshot(),
                row.targetValueHealthSnapshot(),

                row.redeploymentOwnerUserId(),
                row.redeploymentOwnerName(),
                row.redeploymentObjective(),

                metric.releasedRedeploymentAmount(),
                metric.remainingRedeploymentAmount(),
                metric.redeploymentPct(),
                metric.redeploymentVarianceAmount(),
                metric.health(),

                row.status(),

                gates.size(),
                resolvedGates,
                pendingGates,
                repository
                        .authorizations(
                                row.id()
                        )
                        .size(),
                repository
                        .releases(
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

    private CapitalRedeploymentMetricResult metrics(
            CapitalRedeploymentRepository.CaseRow redeploymentCase
    ) {
        return mathService
                .metrics(
                        redeploymentCase.approvedRedeploymentAmount(),
                        repository
                                .releases(
                                        redeploymentCase.id()
                                )
                                .stream()
                                .map(
                                        CapitalRedeploymentRepository.ReleaseRow::
                                                releasedAmount
                                )
                                .toList(),
                        redeploymentCase.status()
                );
    }

    private CapitalRedeploymentGateResponse gateResponse(
            CapitalRedeploymentRepository.GateRow row
    ) {
        return new CapitalRedeploymentGateResponse(
                row.id(),
                row.redeploymentCaseId(),
                row.gateNumber(),
                row.title(),
                row.requirement(),
                row.status(),
                row.evidenceNote(),
                row.decisionNote(),
                row.decidedByName(),
                row.decidedAt(),
                row.createdAt()
        );
    }

    private CapitalRedeploymentAuthorizationResponse authorizationResponse(
            CapitalRedeploymentRepository.AuthorizationRow row
    ) {
        return new CapitalRedeploymentAuthorizationResponse(
                row.id(),
                row.redeploymentCaseId(),
                row.decision(),
                mathService.money(
                        row.authorizedAmount()
                ),
                row.authorizationNote(),
                row.authorizedByName(),
                row.authorizedAt()
        );
    }

    private CapitalRedeploymentReleaseResponse releaseResponse(
            CapitalRedeploymentRepository.ReleaseRow row
    ) {
        return new CapitalRedeploymentReleaseResponse(
                row.id(),
                row.redeploymentCaseId(),
                row.authorizationId(),
                row.releasedOn(),
                mathService.money(
                        row.releasedAmount()
                ),
                row.evidenceNote(),
                row.referenceText(),
                row.releasedByName(),
                row.releasedAt()
        );
    }

    private CapitalRedeploymentVerificationResponse verificationResponse(
            CapitalRedeploymentRepository.VerificationRow row
    ) {
        return new CapitalRedeploymentVerificationResponse(
                row.id(),
                row.redeploymentCaseId(),
                row.decision(),
                mathService.money(
                        row.approvedRedeploymentAmount()
                ),
                mathService.money(
                        row.releasedRedeploymentAmount()
                ),
                mathService.money(
                        row.remainingRedeploymentAmount()
                ),
                mathService.percent(
                        row.redeploymentPct()
                ),
                mathService.money(
                        row.redeploymentVarianceAmount()
                ),
                row.verificationNote(),
                row.verifiedByName(),
                row.verifiedAt()
        );
    }

    private CapitalRedeploymentSummaryResponse summary(
            int candidateCount,
            List<CapitalRedeploymentCaseResponse> cases
    ) {
        List<CapitalRedeploymentCaseResponse> active =
                cases.stream()
                        .filter(
                                redeploymentCase ->
                                        redeploymentCase.status()
                                                != CapitalRedeploymentStatus.CLOSED
                        )
                        .toList();

        int authorizationPending =
                (
                        int
                ) active.stream()
                        .filter(
                                redeploymentCase ->
                                        redeploymentCase.status()
                                                == CapitalRedeploymentStatus.READY_FOR_AUTHORIZATION
                                        ||
                                        redeploymentCase.status()
                                                == CapitalRedeploymentStatus.AUTHORIZED
                        )
                        .count();

        return new CapitalRedeploymentSummaryResponse(
                candidateCount,
                active.size(),

                countStatus(
                        active,
                        CapitalRedeploymentStatus.PLANNED
                ),

                authorizationPending,

                countStatus(
                        active,
                        CapitalRedeploymentStatus.ACTIVE
                ),

                countStatus(
                        active,
                        CapitalRedeploymentStatus.READY_FOR_VERIFICATION
                ),

                countStatus(
                        active,
                        CapitalRedeploymentStatus.VERIFIED
                ),

                countStatus(
                        active,
                        CapitalRedeploymentStatus.REMEDIATION_REQUIRED
                ),

                sum(
                        active.stream()
                                .map(
                                        CapitalRedeploymentCaseResponse::
                                                approvedRedeploymentAmount
                                )
                                .toList()
                ),

                sum(
                        active.stream()
                                .map(
                                        CapitalRedeploymentCaseResponse::
                                                releasedRedeploymentAmount
                                )
                                .toList()
                ),

                sum(
                        active.stream()
                                .map(
                                        CapitalRedeploymentCaseResponse::
                                                remainingRedeploymentAmount
                                )
                                .toList()
                ),

                mathService.averagePct(
                        active.stream()
                                .map(
                                        CapitalRedeploymentCaseResponse::
                                                redeploymentPct
                                )
                                .toList()
                )
        );
    }

    private CapitalRedeploymentSnapshotSummaryResponse snapshotSummary(
            CapitalRedeploymentRepository.SnapshotRow row
    ) {
        return new CapitalRedeploymentSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.caseCount(),
                row.plannedCaseCount(),
                row.authorizationPendingCaseCount(),
                row.activeCaseCount(),
                row.readyCaseCount(),
                row.verifiedCaseCount(),
                row.remediationCaseCount(),
                mathService.money(
                        row.totalApprovedRedeploymentAmount()
                ),
                mathService.money(
                        row.totalReleasedRedeploymentAmount()
                ),
                mathService.money(
                        row.totalRemainingRedeploymentAmount()
                ),
                mathService.percent(
                        row.averageRedeploymentPct()
                ),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private CapitalRedeploymentSnapshotItemResponse snapshotItemResponse(
            CapitalRedeploymentRepository.SnapshotItemRow row
    ) {
        return new CapitalRedeploymentSnapshotItemResponse(
                row.redeploymentCaseId(),
                row.redeploymentNumber(),
                row.recyclingSourceNumber(),
                row.targetValueCaseNumber(),
                row.targetInitiativeTitle(),
                row.currency(),
                row.caseStatus(),
                mathService.money(
                        row.approvedRedeploymentAmount()
                ),
                mathService.money(
                        row.releasedRedeploymentAmount()
                ),
                mathService.money(
                        row.remainingRedeploymentAmount()
                ),
                mathService.percent(
                        row.redeploymentPct()
                ),
                mathService.money(
                        row.redeploymentVarianceAmount()
                ),
                row.redeploymentHealth(),
                mathService.money(
                        row.currentSourceFundingRemainingAmount()
                ),
                row.gateCount(),
                row.resolvedGateCount(),
                row.authorizationCount(),
                row.releaseCount()
        );
    }

    private void validateCandidateCapitalSafety(
            CapitalRedeploymentCandidateResponse candidate
    ) {
        BigDecimal approved =
                mathService.money(
                        candidate.approvedRedeploymentAmount()
                );

        if (
                approved.compareTo(
                        mathService.money(
                                candidate.sourceRecyclableCapitalAmount()
                        )
                )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Approved Step 62 reinvestment exceeds the recycling-source capital authority."
            );
        }

        if (
                approved.compareTo(
                        mathService.money(
                                candidate.currentSourceFundingRemainingAmount()
                        )
                )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Approved Step 62 reinvestment now exceeds current unreleased Step 58 source capital."
            );
        }
    }

    private void validateCurrentAuthority(
            UUID currentUserId,
            CapitalRedeploymentRepository.CaseRow redeploymentCase
    ) {
        CapitalRecyclingSourceDetailResponse recyclingDetail =
                capitalRecyclingService
                        .source(
                                currentUserId,
                                redeploymentCase.recyclingSourceId()
                        );

        CapitalReinvestmentProposalResponse proposal =
                recyclingDetail
                        .proposals()
                        .stream()
                        .filter(
                                candidate ->
                                        candidate.id()
                                                .equals(
                                                        redeploymentCase.reinvestmentProposalId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Authoritative Step 62 reinvestment proposal no longer exists."
                                        )
                        );

        if (
                proposal.decision()
                        == null
                ||
                proposal.decision()
                        .decision()
                        != CapitalReinvestmentDecision.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Step 62 reinvestment proposal is not an approved redeployment authority."
            );
        }

        if (
                mathService.money(
                        proposal.requestedReinvestmentAmount()
                )
                        .compareTo(
                                mathService.money(
                                        redeploymentCase.approvedRedeploymentAmount()
                                )
                        )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 62 approved reinvestment amount no longer matches the frozen redeployment authority."
            );
        }

        FundingCommitmentResponse funding =
                currentSourceFunding(
                        currentUserId,
                        redeploymentCase.sourceFundingCommitmentId()
                );

        if (
                mathService.money(
                        redeploymentCase.approvedRedeploymentAmount()
                )
                        .compareTo(
                                mathService.money(
                                        funding.remainingCommitmentAmount()
                                )
                        )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Frozen redeployment authority now exceeds current unreleased Step 58 source capital."
            );
        }

        validateTarget(
                currentUserId,
                redeploymentCase.targetValueCaseId(),
                redeploymentCase.currency(),
                redeploymentCase.fiscalYear()
        );
    }

    private StrategicValueCaseResponse validateTarget(
            UUID currentUserId,
            UUID targetValueCaseId,
            String currency,
            int fiscalYear
    ) {
        StrategicValueCaseResponse target =
                strategicValueService
                        .valueCase(
                                currentUserId,
                                targetValueCaseId
                        )
                        .valueCase();

        if (
                target.status()
                        != StrategicValueCaseStatus.VERIFIED
                &&
                target.status()
                        != StrategicValueCaseStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Redeployment target must remain a verified or closed Step 56 value case."
            );
        }

        if (
                !target.currency()
                        .equalsIgnoreCase(
                                currency
                        )
        ) {
            throw new IllegalArgumentException(
                    "Redeployment target currency must match the approved Step 62 source currency."
            );
        }

        if (
                target.fiscalYear()
                        != fiscalYear
        ) {
            throw new IllegalArgumentException(
                    "Redeployment target fiscal year must match the approved Step 62 source fiscal year."
            );
        }

        if (
                target.valueHealth()
                        == StrategicValueHealth.AT_RISK
                ||
                target.valueHealth()
                        == StrategicValueHealth.UNASSESSED
        ) {
            throw new IllegalArgumentException(
                    "Redeployment target cannot be unassessed or at risk."
            );
        }

        return target;
    }

    private FundingCommitmentResponse currentSourceFunding(
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

    private CapitalRedeploymentRepository.CaseRow requireCase(
            UUID caseId
    ) {
        CapitalRedeploymentRepository.CaseRow redeploymentCase =
                repository
                        .findCase(
                                caseId
                        );

        if (redeploymentCase == null) {
            throw new ResourceNotFoundException(
                    "Capital-redeployment case not found: "
                            + caseId
            );
        }

        return redeploymentCase;
    }

    private CapitalRedeploymentRepository.GateRow requireGate(
            UUID gateId
    ) {
        CapitalRedeploymentRepository.GateRow gate =
                repository
                        .findGate(
                                gateId
                        );

        if (gate == null) {
            throw new ResourceNotFoundException(
                    "Capital-redeployment gate not found: "
                            + gateId
            );
        }

        return gate;
    }

    private AppUserEntity requireRedeploymentUser(
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
                    "Requester accounts cannot own capital-redeployment governance."
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
            List<CapitalRedeploymentCaseResponse> cases,
            CapitalRedeploymentStatus status
    ) {
        return (
                int
        ) cases.stream()
                .filter(
                        redeploymentCase ->
                                redeploymentCase.status()
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
                "REDEPLOY-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextCaseSequence()
        );
    }

    private String nextGateNumber() {
        return String.format(
                "RDP-GATE-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextGateSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "RDPSNAP-%d-%05d",
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
                    "Your ProcureIQ role cannot access capital-redeployment governance."
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
                    "Your ProcureIQ role cannot manage capital-redeployment planning."
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
                    "Only administrators and procurement managers can authorize, release or verify redeployed capital."
            );
        }
    }
}
