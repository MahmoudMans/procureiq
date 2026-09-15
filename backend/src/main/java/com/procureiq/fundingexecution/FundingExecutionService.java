package com.procureiq.fundingexecution;

import com.procureiq.capitalallocation.CapitalAllocationCycleDetailResponse;
import com.procureiq.capitalallocation.CapitalAllocationCycleResponse;
import com.procureiq.capitalallocation.CapitalAllocationCycleStatus;
import com.procureiq.capitalallocation.CapitalAllocationDashboardResponse;
import com.procureiq.capitalallocation.CapitalAllocationDecision;
import com.procureiq.capitalallocation.CapitalAllocationItemResponse;
import com.procureiq.capitalallocation.CapitalAllocationService;
import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class FundingExecutionService {

    private final FundingExecutionRepository repository;

    private final FundingExecutionMathService mathService;

    private final CapitalAllocationService capitalAllocationService;

    private final AppUserRepository appUserRepository;

    public FundingExecutionService(
            FundingExecutionRepository repository,
            FundingExecutionMathService mathService,
            CapitalAllocationService capitalAllocationService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.capitalAllocationService =
                capitalAllocationService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public FundingExecutionDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<FundingCandidateResponse> candidates =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                candidate ->
                                        repository
                                                .findCommitmentByAllocationItem(
                                                        candidate.allocationItemId()
                                                )
                                        == null
                        )
                        .toList();

        List<FundingCommitmentResponse> commitments =
                repository
                        .commitments()
                        .stream()
                        .map(
                                this::commitmentResponse
                        )
                        .toList();

        return new FundingExecutionDashboardResponse(
                summary(
                        candidates.size(),
                        commitments
                ),
                repository.users(),
                candidates,
                commitments,
                repository
                        .snapshots()
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public FundingCommitmentDetailResponse createCommitment(
            UUID currentUserId,
            UUID allocationItemId,
            FundingCommitmentInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .findCommitmentByAllocationItem(
                                allocationItemId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "A funding commitment already exists for this Step 57 funded allocation item."
            );
        }

        FundingCandidateResponse candidate =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                source ->
                                        source
                                                .allocationItemId()
                                                .equals(
                                                        allocationItemId
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Allocation item is not an approved Step 57 FUND decision."
                                        )
                        );

        BigDecimal committed =
                mathService.money(
                        input.committedCapitalAmount()
                );

        BigDecimal authorized =
                mathService.money(
                        candidate.authorizedCapitalAmount()
                );

        if (
                committed.compareTo(
                        authorized
                )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Funding commitment cannot exceed the Step 57 authorized capital ceiling."
            );
        }

        AppUserEntity owner =
                requireFundingUser(
                        input.fundingOwnerUserId()
                );

        UUID commitmentId =
                UUID.randomUUID();

        repository.createCommitment(
                commitmentId,
                nextCommitmentNumber(),
                candidate,
                input,
                owner.getFullName(),
                currentUserId
        );

        return commitment(
                currentUserId,
                commitmentId
        );
    }

    @Transactional(readOnly = true)
    public FundingCommitmentDetailResponse commitment(
            UUID currentUserId,
            UUID commitmentId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        FundingExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        commitmentId
                );

        return new FundingCommitmentDetailResponse(
                commitmentResponse(
                        commitment
                ),
                repository.users(),
                repository
                        .tranches(
                                commitmentId
                        )
                        .stream()
                        .map(
                                this::trancheResponse
                        )
                        .toList()
        );
    }

    public FundingCommitmentDetailResponse createTranche(
            UUID currentUserId,
            UUID commitmentId,
            FundingTrancheInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        FundingExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        commitmentId
                );

        if (
                commitment.status()
                        != FundingCommitmentStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Funding tranches can be designed only while the funding commitment is PLANNED."
            );
        }

        if (
                input.targetDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Funding-tranche target date cannot be in the past."
            );
        }

        BigDecimal existingPlanned =
                repository
                        .tranches(
                                commitmentId
                        )
                        .stream()
                        .map(
                                FundingExecutionRepository.TrancheRow::
                                        plannedReleaseAmount
                        )
                        .map(
                                mathService::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal resultingPlan =
                existingPlanned
                        .add(
                                mathService.money(
                                        input.plannedReleaseAmount()
                                )
                        );

        if (
                resultingPlan.compareTo(
                        mathService.money(
                                commitment.committedCapitalAmount()
                        )
                )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Funding-tranche plan cannot exceed committed capital."
            );
        }

        repository.createTranche(
                UUID.randomUUID(),
                nextTrancheNumber(),
                commitmentId,
                input,
                currentUserId
        );

        return commitment(
                currentUserId,
                commitmentId
        );
    }

    public FundingCommitmentDetailResponse createGate(
            UUID currentUserId,
            UUID trancheId,
            FundingGateInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        FundingExecutionRepository.TrancheRow tranche =
                requireTranche(
                        trancheId
                );

        FundingExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        tranche.commitmentId()
                );

        if (
                commitment.status()
                        != FundingCommitmentStatus.PLANNED
                &&
                commitment.status()
                        != FundingCommitmentStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Release gates cannot be added after funding has been fully released."
            );
        }

        if (
                tranche.status()
                        != FundingTrancheStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Release gates can be added only before authorization is requested."
            );
        }

        repository.createGate(
                UUID.randomUUID(),
                trancheId,
                input,
                currentUserId
        );

        return commitment(
                currentUserId,
                tranche.commitmentId()
        );
    }

    public FundingCommitmentDetailResponse decideGate(
            UUID currentUserId,
            UUID gateId,
            FundingGateDecisionInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                input.decision()
                        == FundingGateStatus.PENDING
        ) {
            throw new IllegalArgumentException(
                    "Funding-gate decisions must be SATISFIED or WAIVED."
            );
        }

        FundingExecutionRepository.GateRow gate =
                requireGate(
                        gateId
                );

        if (
                gate.status()
                        != FundingGateStatus.PENDING
        ) {
            throw new IllegalArgumentException(
                    "Funding gate already has a final decision."
            );
        }

        FundingExecutionRepository.TrancheRow tranche =
                requireTranche(
                        gate.trancheId()
                );

        if (
                tranche.status()
                        != FundingTrancheStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Funding-gate decisions must be completed before tranche authorization is requested."
            );
        }

        repository.decideGate(
                gateId,
                input,
                currentUserId
        );

        return commitment(
                currentUserId,
                tranche.commitmentId()
        );
    }

    public FundingCommitmentDetailResponse activateCommitment(
            UUID currentUserId,
            UUID commitmentId,
            FundingNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        FundingExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        commitmentId
                );

        if (
                commitment.status()
                        != FundingCommitmentStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only a planned funding commitment can be activated."
            );
        }

        List<FundingExecutionRepository.TrancheRow> tranches =
                repository
                        .tranches(
                                commitmentId
                        );

        if (tranches.isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one funding tranche is required before activation."
            );
        }

        BigDecimal planned =
                tranches.stream()
                        .map(
                                FundingExecutionRepository.TrancheRow::
                                        plannedReleaseAmount
                        )
                        .map(
                                mathService::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        if (
                !mathService
                        .exactFundingPlan(
                                commitment.committedCapitalAmount(),
                                planned
                        )
        ) {
            throw new IllegalArgumentException(
                    "Total planned tranche releases must exactly equal committed capital before activation."
            );
        }

        boolean missingGate =
                tranches.stream()
                        .anyMatch(
                                tranche ->
                                        repository
                                                .gates(
                                                        tranche.id()
                                                )
                                                .isEmpty()
                        );

        if (missingGate) {
            throw new IllegalArgumentException(
                    "Every funding tranche requires at least one evidence gate before commitment activation."
            );
        }

        repository.activateCommitment(
                commitmentId,
                input.note(),
                currentUserId
        );

        return commitment(
                currentUserId,
                commitmentId
        );
    }

    public FundingCommitmentDetailResponse requestAuthorization(
            UUID currentUserId,
            UUID trancheId,
            FundingNoteInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        FundingExecutionRepository.TrancheRow tranche =
                requireTranche(
                        trancheId
                );

        FundingExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        tranche.commitmentId()
                );

        if (
                commitment.status()
                        != FundingCommitmentStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Funding-release authorization can be requested only for an ACTIVE funding commitment."
            );
        }

        if (
                tranche.status()
                        != FundingTrancheStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only a planned funding tranche can request authorization."
            );
        }

        List<FundingExecutionRepository.GateRow> gates =
                repository
                        .gates(
                                trancheId
                        );

        if (gates.isEmpty()) {
            throw new IllegalArgumentException(
                    "Funding tranche requires at least one evidence gate."
            );
        }

        boolean pending =
                gates.stream()
                        .anyMatch(
                                gate ->
                                        gate.status()
                                                == FundingGateStatus.PENDING
                        );

        if (pending) {
            throw new IllegalArgumentException(
                    "Every funding gate must be satisfied or waived before authorization can be requested."
            );
        }

        repository.requestAuthorization(
                trancheId,
                input.note(),
                currentUserId
        );

        return commitment(
                currentUserId,
                tranche.commitmentId()
        );
    }

    public FundingCommitmentDetailResponse authorizeTranche(
            UUID currentUserId,
            UUID trancheId,
            FundingAuthorizationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        FundingExecutionRepository.TrancheRow tranche =
                requireTranche(
                        trancheId
                );

        FundingExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        tranche.commitmentId()
                );

        if (
                commitment.status()
                        != FundingCommitmentStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Funding authorization requires an ACTIVE funding commitment."
            );
        }

        if (
                tranche.status()
                        != FundingTrancheStatus.READY_FOR_AUTHORIZATION
        ) {
            throw new IllegalArgumentException(
                    "Funding tranche is not ready for authorization."
            );
        }

        repository.createAuthorization(
                UUID.randomUUID(),
                trancheId,
                commitment.id(),
                tranche.plannedReleaseAmount(),
                input,
                currentUserId
        );

        if (
                input.decision()
                        == FundingAuthorizationDecision.APPROVED
        ) {
            repository.markTrancheAuthorized(
                    trancheId
            );
        } else {
            repository.returnTrancheToPlanned(
                    trancheId
            );
        }

        return commitment(
                currentUserId,
                commitment.id()
        );
    }

    public FundingCommitmentDetailResponse releaseTranche(
            UUID currentUserId,
            UUID trancheId,
            FundingNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        FundingExecutionRepository.TrancheRow tranche =
                requireTranche(
                        trancheId
                );

        FundingExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        tranche.commitmentId()
                );

        if (
                commitment.status()
                        != FundingCommitmentStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Capital can be released only from an ACTIVE funding commitment."
            );
        }

        if (
                tranche.status()
                        != FundingTrancheStatus.AUTHORIZED
        ) {
            throw new IllegalArgumentException(
                    "Capital release requires an explicitly authorized funding tranche."
            );
        }

        if (
                repository
                        .release(
                                trancheId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "Funding tranche already has an immutable release record."
            );
        }

        FundingExecutionRepository.AuthorizationRow authorization =
                repository
                        .latestApprovedAuthorization(
                                trancheId
                        );

        if (authorization == null) {
            throw new IllegalArgumentException(
                    "Funding tranche does not have an approved authorization record."
            );
        }

        repository.createRelease(
                UUID.randomUUID(),
                trancheId,
                commitment.id(),
                authorization.id(),
                tranche.plannedReleaseAmount(),
                input.note(),
                currentUserId
        );

        repository.markTrancheReleased(
                trancheId
        );

        List<FundingExecutionRepository.TrancheRow> refreshed =
                repository
                        .tranches(
                                commitment.id()
                        );

        boolean allReleased =
                !refreshed.isEmpty()
                &&
                refreshed.stream()
                        .allMatch(
                                candidate ->
                                        candidate.status()
                                                == FundingTrancheStatus.RELEASED
                        );

        if (allReleased) {
            repository.markFullyReleased(
                    commitment.id()
            );
        }

        FundingCommitmentDetailResponse result =
                commitment(
                        currentUserId,
                        commitment.id()
                );

        captureSnapshotInternal(
                currentUserId,
                result
        );

        return result;
    }

    public FundingCommitmentDetailResponse closeCommitment(
            UUID currentUserId,
            UUID commitmentId,
            FundingNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        FundingExecutionRepository.CommitmentRow commitment =
                requireCommitment(
                        commitmentId
                );

        if (
                commitment.status()
                        != FundingCommitmentStatus.FULLY_RELEASED
        ) {
            throw new IllegalArgumentException(
                    "Only a fully released funding commitment can be closed."
            );
        }

        repository.closeCommitment(
                commitmentId,
                input.note(),
                currentUserId
        );

        FundingCommitmentDetailResponse result =
                commitment(
                        currentUserId,
                        commitmentId
                );

        captureSnapshotInternal(
                currentUserId,
                result
        );

        return result;
    }

    public FundingSnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            UUID commitmentId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return captureSnapshotInternal(
                currentUserId,
                commitment(
                        currentUserId,
                        commitmentId
                )
        );
    }

    @Transactional(readOnly = true)
    public FundingSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        FundingExecutionRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Funding execution snapshot not found: "
                            + snapshotId
            );
        }

        return new FundingSnapshotDetailResponse(
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

    private FundingSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId,
            FundingCommitmentDetailResponse detail
    ) {
        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                detail.commitment(),
                currentUserId
        );

        for (
                FundingTrancheResponse tranche
                : detail.tranches()
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    tranche
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<FundingCandidateResponse> sourceCandidates(
            UUID currentUserId
    ) {
        CapitalAllocationDashboardResponse dashboard =
                capitalAllocationService
                        .dashboard(
                                currentUserId
                        );

        return dashboard
                .cycles()
                .stream()
                .filter(
                        cycle ->
                                cycle.status()
                                        == CapitalAllocationCycleStatus.APPROVED
                                ||
                                cycle.status()
                                        == CapitalAllocationCycleStatus.CLOSED
                )
                .map(
                        cycle ->
                                capitalAllocationService
                                        .cycle(
                                                currentUserId,
                                                cycle.id()
                                        )
                )
                .flatMap(
                        detail ->
                                detail
                                        .items()
                                        .stream()
                                        .filter(
                                                item ->
                                                        item.decision()
                                                                == CapitalAllocationDecision.FUND
                                        )
                                        .map(
                                                item ->
                                                        candidateResponse(
                                                                detail.cycle(),
                                                                item
                                                        )
                                        )
                )
                .toList();
    }

    private FundingCandidateResponse candidateResponse(
            CapitalAllocationCycleResponse cycle,
            CapitalAllocationItemResponse item
    ) {
        return new FundingCandidateResponse(
                cycle.id(),
                cycle.cycleNumber(),
                cycle.title(),
                cycle.status(),
                item.id(),
                item.valueCaseId(),
                item.caseNumber(),
                item.initiativeNumber(),
                item.initiativeTitle(),
                item.valueOwnerName(),
                item.currency(),
                item.fiscalYear(),
                mathService.money(
                        item.requestedCapitalAmount()
                ),
                item.priorityScore(),
                item.recommendation(),
                item.decision(),
                item.roiPctSnapshot(),
                item.persistencePctSnapshot(),
                item.netValueSnapshot()
        );
    }

    private FundingCommitmentResponse commitmentResponse(
            FundingExecutionRepository.CommitmentRow row
    ) {
        List<FundingTrancheResponse> tranches =
                repository
                        .tranches(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::trancheResponse
                        )
                        .toList();

        BigDecimal planned =
                tranches.stream()
                        .map(
                                FundingTrancheResponse::
                                        plannedReleaseAmount
                        )
                        .map(
                                mathService::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal released =
                tranches.stream()
                        .map(
                                FundingTrancheResponse::
                                        release
                        )
                        .filter(
                                java.util.Objects::nonNull
                        )
                        .map(
                                FundingReleaseResponse::
                                        releasedAmount
                        )
                        .map(
                                mathService::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        FundingMetricResult metric =
                mathService
                        .metrics(
                                row.authorizedCapitalAmount(),
                                row.committedCapitalAmount(),
                                planned,
                                released
                        );

        int releasedTrancheCount =
                (
                        int
                ) tranches.stream()
                        .filter(
                                tranche ->
                                        tranche.status()
                                                == FundingTrancheStatus.RELEASED
                        )
                        .count();

        int pendingGates =
                tranches.stream()
                        .mapToInt(
                                FundingTrancheResponse::
                                        pendingGateCount
                        )
                        .sum();

        return new FundingCommitmentResponse(
                row.id(),
                row.commitmentNumber(),
                row.allocationCycleId(),
                row.allocationCycleNumber(),
                row.allocationCycleTitle(),
                row.allocationItemId(),
                row.valueCaseId(),
                row.caseNumber(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                row.currency(),
                row.fiscalYear(),
                mathService.money(
                        row.authorizedCapitalAmount()
                ),
                mathService.money(
                        row.committedCapitalAmount()
                ),
                row.fundingOwnerUserId(),
                row.fundingOwnerName(),
                row.objective(),
                row.status(),

                mathService.money(
                        planned
                ),
                mathService.money(
                        released
                ),
                metric.remainingAuthorizationAmount(),
                metric.remainingCommitmentAmount(),
                metric.plannedCoveragePct(),
                metric.releasePct(),

                tranches.size(),
                releasedTrancheCount,
                pendingGates,

                row.activatedByName(),
                row.activatedAt(),
                row.activationNote(),
                row.closedByName(),
                row.closedAt(),
                row.closeNote(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private FundingTrancheResponse trancheResponse(
            FundingExecutionRepository.TrancheRow row
    ) {
        List<FundingGateResponse> gates =
                repository
                        .gates(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::gateResponse
                        )
                        .toList();

        List<FundingAuthorizationResponse> authorizations =
                repository
                        .authorizations(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::authorizationResponse
                        )
                        .toList();

        FundingExecutionRepository.ReleaseRow release =
                repository
                        .release(
                                row.id()
                        );

        int resolved =
                (
                        int
                ) gates.stream()
                        .filter(
                                gate ->
                                        gate.status()
                                                != FundingGateStatus.PENDING
                        )
                        .count();

        int pending =
                gates.size()
                - resolved;

        return new FundingTrancheResponse(
                row.id(),
                row.commitmentId(),
                row.trancheNumber(),
                row.sequenceNo(),
                row.title(),
                mathService.money(
                        row.plannedReleaseAmount()
                ),
                row.targetDate(),
                row.status(),
                row.requestNote(),
                row.requestedByName(),
                row.requestedAt(),
                gates.size(),
                resolved,
                pending,
                gates,
                authorizations,
                release == null
                        ? null
                        : releaseResponse(
                                release
                        ),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private FundingGateResponse gateResponse(
            FundingExecutionRepository.GateRow row
    ) {
        return new FundingGateResponse(
                row.id(),
                row.trancheId(),
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

    private FundingAuthorizationResponse authorizationResponse(
            FundingExecutionRepository.AuthorizationRow row
    ) {
        return new FundingAuthorizationResponse(
                row.id(),
                row.trancheId(),
                row.decision(),
                mathService.money(
                        row.authorizedAmount()
                ),
                row.authorizationNote(),
                row.authorizedByName(),
                row.authorizedAt()
        );
    }

    private FundingReleaseResponse releaseResponse(
            FundingExecutionRepository.ReleaseRow row
    ) {
        return new FundingReleaseResponse(
                row.id(),
                row.trancheId(),
                row.authorizationId(),
                mathService.money(
                        row.releasedAmount()
                ),
                row.releaseNote(),
                row.releasedByName(),
                row.releasedAt()
        );
    }

    private FundingDashboardSummaryResponse summary(
            int candidateCount,
            List<FundingCommitmentResponse> commitments
    ) {
        return new FundingDashboardSummaryResponse(
                candidateCount,
                commitments.size(),

                countCommitmentStatus(
                        commitments,
                        FundingCommitmentStatus.PLANNED
                ),

                countCommitmentStatus(
                        commitments,
                        FundingCommitmentStatus.ACTIVE
                ),

                countCommitmentStatus(
                        commitments,
                        FundingCommitmentStatus.FULLY_RELEASED
                ),

                countCommitmentStatus(
                        commitments,
                        FundingCommitmentStatus.CLOSED
                ),

                sum(
                        commitments.stream()
                                .map(
                                        FundingCommitmentResponse::
                                                authorizedCapitalAmount
                                )
                                .toList()
                ),

                sum(
                        commitments.stream()
                                .map(
                                        FundingCommitmentResponse::
                                                committedCapitalAmount
                                )
                                .toList()
                ),

                sum(
                        commitments.stream()
                                .map(
                                        FundingCommitmentResponse::
                                                releasedAmount
                                )
                                .toList()
                ),

                sum(
                        commitments.stream()
                                .map(
                                        FundingCommitmentResponse::
                                                remainingCommitmentAmount
                                )
                                .toList()
                )
        );
    }

    private FundingSnapshotSummaryResponse snapshotSummary(
            FundingExecutionRepository.SnapshotRow row
    ) {
        return new FundingSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.commitmentId(),
                row.commitmentNumber(),
                row.allocationCycleNumber(),
                row.caseNumber(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                row.currency(),
                row.fiscalYear(),
                row.commitmentStatus(),
                mathService.money(
                        row.authorizedCapitalAmount()
                ),
                mathService.money(
                        row.committedCapitalAmount()
                ),
                mathService.money(
                        row.plannedReleaseAmount()
                ),
                mathService.money(
                        row.releasedAmount()
                ),
                mathService.money(
                        row.remainingCommitmentAmount()
                ),
                mathService.money(
                        row.remainingAuthorizationAmount()
                ),
                row.releasePct(),
                row.trancheCount(),
                row.releasedTrancheCount(),
                row.pendingGateCount(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private FundingSnapshotItemResponse snapshotItemResponse(
            FundingExecutionRepository.SnapshotItemRow row
    ) {
        return new FundingSnapshotItemResponse(
                row.trancheId(),
                row.trancheNumber(),
                row.sequenceNo(),
                row.title(),
                mathService.money(
                        row.plannedReleaseAmount()
                ),
                mathService.money(
                        row.releasedAmount()
                ),
                row.status(),
                row.gateCount(),
                row.resolvedGateCount(),
                row.authorizationCount()
        );
    }

    private FundingExecutionRepository.CommitmentRow requireCommitment(
            UUID commitmentId
    ) {
        FundingExecutionRepository.CommitmentRow commitment =
                repository
                        .findCommitment(
                                commitmentId
                        );

        if (commitment == null) {
            throw new ResourceNotFoundException(
                    "Funding commitment not found: "
                            + commitmentId
            );
        }

        return commitment;
    }

    private FundingExecutionRepository.TrancheRow requireTranche(
            UUID trancheId
    ) {
        FundingExecutionRepository.TrancheRow tranche =
                repository
                        .findTranche(
                                trancheId
                        );

        if (tranche == null) {
            throw new ResourceNotFoundException(
                    "Funding tranche not found: "
                            + trancheId
            );
        }

        return tranche;
    }

    private FundingExecutionRepository.GateRow requireGate(
            UUID gateId
    ) {
        FundingExecutionRepository.GateRow gate =
                repository
                        .findGate(
                                gateId
                        );

        if (gate == null) {
            throw new ResourceNotFoundException(
                    "Funding gate not found: "
                            + gateId
            );
        }

        return gate;
    }

    private AppUserEntity requireFundingUser(
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
                    "Requester accounts cannot own strategic funding commitments."
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

    private int countCommitmentStatus(
            List<FundingCommitmentResponse> commitments,
            FundingCommitmentStatus status
    ) {
        return (
                int
        ) commitments.stream()
                .filter(
                        commitment ->
                                commitment.status()
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
                        java.math.RoundingMode.HALF_UP
                );
    }

    private String nextCommitmentNumber() {
        return String.format(
                "FUND-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextCommitmentSequence()
        );
    }

    private String nextTrancheNumber() {
        return String.format(
                "TRN-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextTrancheSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "FUNDSNAP-%d-%05d",
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
                    "Your ProcureIQ role cannot access strategic funding execution."
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
                    "Your ProcureIQ role cannot manage strategic funding execution."
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
                    "Only administrators and procurement managers can authorize or release strategic capital."
            );
        }
    }
}
