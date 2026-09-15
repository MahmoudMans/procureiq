package com.procureiq.capitalrecycling;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.fundingexecution.FundingCommitmentResponse;
import com.procureiq.fundingexecution.FundingExecutionService;
import com.procureiq.investmentintervention.InvestmentInterventionAction;
import com.procureiq.interventionexecution.InterventionExecutionCaseResponse;
import com.procureiq.interventionexecution.InterventionExecutionDashboardResponse;
import com.procureiq.interventionexecution.InterventionExecutionService;
import com.procureiq.interventionexecution.InterventionExecutionStatus;
import com.procureiq.strategicvalue.StrategicValueCaseResponse;
import com.procureiq.strategicvalue.StrategicValueCaseStatus;
import com.procureiq.strategicvalue.StrategicValueDashboardResponse;
import com.procureiq.strategicvalue.StrategicValueHealth;
import com.procureiq.strategicvalue.StrategicValueService;
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
import java.util.UUID;

@Service
@Transactional
public class CapitalRecyclingService {

    private final CapitalRecyclingRepository repository;

    private final CapitalRecyclingMathService mathService;

    private final InterventionExecutionService interventionExecutionService;

    private final FundingExecutionService fundingExecutionService;

    private final StrategicValueService strategicValueService;

    private final AppUserRepository appUserRepository;

    public CapitalRecyclingService(
            CapitalRecyclingRepository repository,
            CapitalRecyclingMathService mathService,
            InterventionExecutionService interventionExecutionService,
            FundingExecutionService fundingExecutionService,
            StrategicValueService strategicValueService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.interventionExecutionService =
                interventionExecutionService;

        this.fundingExecutionService =
                fundingExecutionService;

        this.strategicValueService =
                strategicValueService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public CapitalRecyclingDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<CapitalRecyclingCandidateResponse> candidates =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                candidate ->
                                        repository
                                                .sourceForExecution(
                                                        candidate.executionCaseId()
                                                )
                                        == null
                        )
                        .toList();

        List<CapitalRecyclingSourceResponse> sources =
                repository
                        .sources()
                        .stream()
                        .map(
                                row ->
                                        sourceResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        return new CapitalRecyclingDashboardResponse(
                summary(
                        candidates.size(),
                        sources
                ),
                repository.users(),
                candidates,
                sources,
                repository
                        .snapshots()
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public CapitalRecyclingSourceDetailResponse createSource(
            UUID currentUserId,
            UUID executionCaseId,
            CapitalRecyclingSourceInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .sourceForExecution(
                                executionCaseId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "A capital-recycling source already exists for this verified Step 61 execution."
            );
        }

        CapitalRecyclingCandidateResponse candidate =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                source ->
                                        source
                                                .executionCaseId()
                                                .equals(
                                                        executionCaseId
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Execution case is not eligible to create recyclable capital."
                                        )
                        );

        AppUserEntity owner =
                requireRecyclingUser(
                        input.sourceOwnerUserId()
                );

        UUID sourceId =
                UUID.randomUUID();

        repository.createSource(
                sourceId,
                nextSourceNumber(),
                candidate,
                input,
                owner.getFullName(),
                currentUserId
        );

        return source(
                currentUserId,
                sourceId
        );
    }

    @Transactional(readOnly = true)
    public CapitalRecyclingSourceDetailResponse source(
            UUID currentUserId,
            UUID sourceId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRecyclingRepository.SourceRow source =
                requireSource(
                        sourceId
                );

        return new CapitalRecyclingSourceDetailResponse(
                sourceResponse(
                        currentUserId,
                        source
                ),
                repository.users(),
                targets(
                        currentUserId,
                        source
                ),
                repository
                        .proposals(
                                sourceId
                        )
                        .stream()
                        .map(
                                this::proposalResponse
                        )
                        .toList()
        );
    }

    public CapitalRecyclingSourceDetailResponse createProposal(
            UUID currentUserId,
            UUID sourceId,
            CapitalReinvestmentProposalInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRecyclingRepository.SourceRow source =
                requireSource(
                        sourceId
                );

        if (
                source.status()
                        != CapitalRecyclingSourceStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Reinvestment proposals can be created only while the recycling source is OPEN."
            );
        }

        if (
                hasPendingProposal(
                        sourceId
                )
        ) {
            throw new IllegalArgumentException(
                    "The recycling source already has a proposal awaiting governance decision."
            );
        }

        CapitalRecyclingSourceResponse current =
                sourceResponse(
                        currentUserId,
                        source
                );

        BigDecimal requested =
                mathService.money(
                        input.requestedReinvestmentAmount()
                );

        if (
                requested.compareTo(
                        BigDecimal.ZERO
                )
                <= 0
        ) {
            throw new IllegalArgumentException(
                    "Reinvestment amount must be positive."
            );
        }

        if (
                requested.compareTo(
                        current.availableCapitalAmount()
                )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Requested reinvestment exceeds currently available recyclable capital."
            );
        }

        CapitalReinvestmentTargetResponse target =
                validateTarget(
                        currentUserId,
                        source,
                        input.targetValueCaseId()
                );

        repository.createProposal(
                UUID.randomUUID(),
                sourceId,
                input,
                target,
                current.availableCapitalAmount(),
                currentUserId
        );

        return source(
                currentUserId,
                sourceId
        );
    }

    public CapitalRecyclingSourceDetailResponse decideProposal(
            UUID currentUserId,
            UUID proposalId,
            CapitalReinvestmentDecisionInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRecyclingRepository.ProposalRow proposal =
                requireProposal(
                        proposalId
                );

        if (
                repository
                        .decision(
                                proposalId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "Reinvestment proposal already has an immutable governance decision."
            );
        }

        CapitalRecyclingRepository.SourceRow source =
                requireSource(
                        proposal.recyclingSourceId()
                );

        if (
                source.status()
                        != CapitalRecyclingSourceStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Reinvestment decision requires an OPEN recycling source."
            );
        }

        if (
                input.decision()
                        == CapitalReinvestmentDecision.APPROVED
        ) {
            CapitalRecyclingSourceResponse current =
                    sourceResponse(
                            currentUserId,
                            source
                    );

            if (
                    mathService.money(
                            proposal.requestedReinvestmentAmount()
                    )
                            .compareTo(
                                    current.availableCapitalAmount()
                                            .add(
                                                    mathService.money(
                                                            proposal.requestedReinvestmentAmount()
                                                    )
                                            )
                            )
                    > 0
            ) {
                throw new IllegalArgumentException(
                        "Reinvestment proposal exceeds currently available recyclable capital."
                );
            }

            validateTarget(
                    currentUserId,
                    source,
                    proposal.targetValueCaseId()
            );

            FundingCommitmentResponse funding =
                    currentFundingCommitment(
                            currentUserId,
                            source.fundingCommitmentId()
                    );

            BigDecimal approvedAlready =
                    approvedAmount(
                            source.id()
                    );

            BigDecimal resultingApproved =
                    approvedAlready
                            .add(
                                    mathService.money(
                                            proposal.requestedReinvestmentAmount()
                                    )
                            );

            BigDecimal currentSafeCeiling =
                    mathService
                            .recyclableCapital(
                                    source.verifiedImplementedCapitalAmount(),
                                    funding.remainingCommitmentAmount()
                            )
                            .min(
                                    mathService.money(
                                            source.recyclableCapitalAmount()
                                    )
                            );

            if (
                    resultingApproved.compareTo(
                            currentSafeCeiling
                    )
                    > 0
            ) {
                throw new IllegalArgumentException(
                        "Approval would exceed the current safe recyclable-capital ceiling."
                );
            }
        }

        repository.createDecision(
                UUID.randomUUID(),
                source.id(),
                proposalId,
                input,
                currentUserId
        );

        if (
                input.decision()
                        == CapitalReinvestmentDecision.APPROVED
        ) {
            BigDecimal approved =
                    approvedAmount(
                            source.id()
                    );

            if (
                    approved.compareTo(
                            mathService.money(
                                    source.recyclableCapitalAmount()
                            )
                    )
                    == 0
            ) {
                repository.markFullyAllocated(
                        source.id()
                );
            }

            captureSnapshotInternal(
                    currentUserId
            );
        }

        return source(
                currentUserId,
                source.id()
        );
    }

    public CapitalRecyclingSourceDetailResponse closeSource(
            UUID currentUserId,
            UUID sourceId,
            CapitalRecyclingNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRecyclingRepository.SourceRow source =
                requireSource(
                        sourceId
                );

        if (
                source.status()
                        != CapitalRecyclingSourceStatus.FULLY_ALLOCATED
        ) {
            throw new IllegalArgumentException(
                    "Only a fully allocated recycling source can be closed."
            );
        }

        if (
                hasPendingProposal(
                        sourceId
                )
        ) {
            throw new IllegalArgumentException(
                    "Recycling source cannot be closed while a proposal is awaiting decision."
            );
        }

        repository.closeSource(
                sourceId,
                input.note(),
                currentUserId
        );

        CapitalRecyclingSourceDetailResponse result =
                source(
                        currentUserId,
                        sourceId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public CapitalRecyclingSnapshotDetailResponse captureSnapshot(
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
    public CapitalRecyclingSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalRecyclingRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Capital-recycling snapshot not found: "
                            + snapshotId
            );
        }

        return new CapitalRecyclingSnapshotDetailResponse(
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

    private CapitalRecyclingSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId
    ) {
        List<CapitalRecyclingSourceResponse> sources =
                repository
                        .sources()
                        .stream()
                        .filter(
                                source ->
                                        source.status()
                                                != CapitalRecyclingSourceStatus.CLOSED
                        )
                        .map(
                                row ->
                                        sourceResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        CapitalRecyclingSummaryResponse summary =
                summary(
                        0,
                        sources
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
                CapitalRecyclingSourceResponse source
                : sources
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    source
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<CapitalRecyclingCandidateResponse> sourceCandidates(
            UUID currentUserId
    ) {
        InterventionExecutionDashboardResponse dashboard =
                interventionExecutionService
                        .dashboard(
                                currentUserId
                        );

        return dashboard
                .cases()
                .stream()
                .filter(
                        execution ->
                                execution.status()
                                        == InterventionExecutionStatus.VERIFIED
                                ||
                                execution.status()
                                        == InterventionExecutionStatus.CLOSED
                )
                .filter(
                        execution ->
                                execution.approvedAction()
                                        == InvestmentInterventionAction.REDUCE_UNRELEASED
                                ||
                                execution.approvedAction()
                                        == InvestmentInterventionAction.REALLOCATE_UNRELEASED
                )
                .filter(
                        execution ->
                                execution.implementationPct()
                                        .compareTo(
                                                new BigDecimal(
                                                        "100.00"
                                                )
                                        )
                                == 0
                )
                .filter(
                        execution ->
                                execution.implementedCapitalAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        )
                                > 0
                )
                .map(
                        execution ->
                                candidateResponse(
                                        currentUserId,
                                        execution
                                )
                )
                .filter(
                        candidate ->
                                candidate.recyclableCapitalAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        )
                                > 0
                )
                .toList();
    }

    private CapitalRecyclingCandidateResponse candidateResponse(
            UUID currentUserId,
            InterventionExecutionCaseResponse execution
    ) {
        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        execution.fundingCommitmentId()
                );

        BigDecimal recyclable =
                mathService
                        .recyclableCapital(
                                execution.implementedCapitalAmount(),
                                funding.remainingCommitmentAmount()
                        );

        return new CapitalRecyclingCandidateResponse(
                execution.id(),
                execution.executionNumber(),
                execution.status(),

                execution.interventionCaseId(),
                execution.interventionNumber(),

                execution.fundingCommitmentId(),
                execution.fundingCommitmentNumber(),

                execution.sourceValueCaseId(),
                execution.sourceValueCaseNumber(),

                execution.initiativeNumber(),
                execution.initiativeTitle(),

                execution.approvedAction(),

                execution.currency(),
                execution.fiscalYear(),

                mathService.money(
                        execution.implementedCapitalAmount()
                ),
                mathService.money(
                        funding.remainingCommitmentAmount()
                ),
                recyclable,

                execution.approvedTargetValueCaseId(),
                execution.approvedTargetValueCaseNumber(),
                execution.approvedTargetInitiativeTitle()
        );
    }

    private CapitalRecyclingSourceResponse sourceResponse(
            UUID currentUserId,
            CapitalRecyclingRepository.SourceRow row
    ) {
        InterventionExecutionCaseResponse execution =
                interventionExecutionService
                        .executionCase(
                                currentUserId,
                                row.executionCaseId()
                        )
                        .executionCase();

        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        row.fundingCommitmentId()
                );

        BigDecimal approved =
                approvedAmount(
                        row.id()
                );

        BigDecimal pending =
                pendingAmount(
                        row.id()
                );

        CapitalRecyclingMetricResult metric =
                mathService
                        .metrics(
                                row.recyclableCapitalAmount(),
                                approved,
                                pending
                        );

        List<CapitalRecyclingRepository.ProposalRow> proposals =
                repository
                        .proposals(
                                row.id()
                        );

        int approvedCount =
                (
                        int
                ) proposals.stream()
                        .filter(
                                proposal -> {
                                    CapitalRecyclingRepository.DecisionRow decision =
                                            repository
                                                    .decision(
                                                            proposal.id()
                                                    );

                                    return decision != null
                                            &&
                                            decision.decision()
                                                    == CapitalReinvestmentDecision.APPROVED;
                                }
                        )
                        .count();

        int pendingCount =
                (
                        int
                ) proposals.stream()
                        .filter(
                                proposal ->
                                        repository
                                                .decision(
                                                        proposal.id()
                                                )
                                        == null
                        )
                        .count();

        return new CapitalRecyclingSourceResponse(
                row.id(),
                row.sourceNumber(),

                row.executionCaseId(),
                row.executionNumber(),
                execution.status(),

                row.interventionCaseId(),
                row.interventionNumber(),

                row.fundingCommitmentId(),
                row.fundingCommitmentNumber(),

                row.sourceValueCaseId(),
                row.sourceValueCaseNumber(),

                row.sourceInitiativeNumber(),
                row.sourceInitiativeTitle(),

                row.sourceAction(),

                row.currency(),
                row.fiscalYear(),

                mathService.money(
                        row.verifiedImplementedCapitalAmount()
                ),
                mathService.money(
                        row.recyclableCapitalAmount()
                ),
                mathService.money(
                        row.fundingRemainingSnapshot()
                ),
                mathService.money(
                        funding.remainingCommitmentAmount()
                ),

                metric.approvedReinvestmentAmount(),
                metric.pendingReinvestmentAmount(),
                metric.availableCapitalAmount(),
                metric.utilizationPct(),

                row.preferredTargetValueCaseId(),
                row.preferredTargetValueCaseNumber(),
                row.preferredTargetInitiativeTitle(),

                row.sourceOwnerUserId(),
                row.sourceOwnerName(),
                row.recyclingObjective(),

                row.status(),

                proposals.size(),
                approvedCount,
                pendingCount,

                row.closeNote(),
                row.closedByName(),
                row.closedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private List<CapitalReinvestmentTargetResponse> targets(
            UUID currentUserId,
            CapitalRecyclingRepository.SourceRow source
    ) {
        StrategicValueDashboardResponse dashboard =
                strategicValueService
                        .dashboard(
                                currentUserId
                        );

        return dashboard
                .cases()
                .stream()
                .filter(
                        target ->
                                target.status()
                                        == StrategicValueCaseStatus.VERIFIED
                                ||
                                target.status()
                                        == StrategicValueCaseStatus.CLOSED
                )
                .filter(
                        target ->
                                !target.id()
                                        .equals(
                                                source.sourceValueCaseId()
                                        )
                )
                .filter(
                        target ->
                                target.currency()
                                        .equalsIgnoreCase(
                                                source.currency()
                                        )
                )
                .filter(
                        target ->
                                target.fiscalYear()
                                        == source.fiscalYear()
                )
                .filter(
                        target ->
                                target.valueHealth()
                                        == StrategicValueHealth.STRONG
                                ||
                                target.valueHealth()
                                        == StrategicValueHealth.HEALTHY
                                ||
                                target.valueHealth()
                                        == StrategicValueHealth.WATCH
                )
                .filter(
                        target ->
                                source.sourceAction()
                                        != InvestmentInterventionAction.REALLOCATE_UNRELEASED
                                ||
                                target.id()
                                        .equals(
                                                source.preferredTargetValueCaseId()
                                        )
                )
                .map(
                        target ->
                                targetResponse(
                                        source,
                                        target
                                )
                )
                .toList();
    }

    private CapitalReinvestmentTargetResponse validateTarget(
            UUID currentUserId,
            CapitalRecyclingRepository.SourceRow source,
            UUID targetValueCaseId
    ) {
        return targets(
                currentUserId,
                source
        )
                .stream()
                .filter(
                        target ->
                                target.valueCaseId()
                                        .equals(
                                                targetValueCaseId
                                        )
                )
                .findFirst()
                .orElseThrow(
                        () ->
                                new IllegalArgumentException(
                                        "Target is not an eligible governed Step 56 reinvestment opportunity."
                                )
                );
    }

    private CapitalReinvestmentTargetResponse targetResponse(
            CapitalRecyclingRepository.SourceRow source,
            StrategicValueCaseResponse target
    ) {
        return new CapitalReinvestmentTargetResponse(
                target.id(),
                target.caseNumber(),
                target.initiativeNumber(),
                target.initiativeTitle(),
                target.currency(),
                target.fiscalYear(),
                target.roiPct(),
                target.persistencePct(),
                target.netValueAmount(),
                target.valueHealth(),
                source.preferredTargetValueCaseId()
                        != null
                        &&
                        source.preferredTargetValueCaseId()
                                .equals(
                                        target.id()
                                )
        );
    }

    private CapitalReinvestmentProposalResponse proposalResponse(
            CapitalRecyclingRepository.ProposalRow row
    ) {
        CapitalRecyclingRepository.DecisionRow decision =
                repository
                        .decision(
                                row.id()
                        );

        return new CapitalReinvestmentProposalResponse(
                row.id(),
                row.recyclingSourceId(),

                row.targetValueCaseId(),
                row.targetValueCaseNumber(),
                row.targetInitiativeNumber(),
                row.targetInitiativeTitle(),

                mathService.money(
                        row.sourceAvailableCapitalSnapshot()
                ),
                mathService.money(
                        row.requestedReinvestmentAmount()
                ),

                row.targetRoiPctSnapshot(),
                row.targetPersistencePctSnapshot(),
                row.targetNetValueSnapshot(),
                row.targetValueHealthSnapshot(),

                row.proposalRationale(),
                row.proposedByName(),
                row.proposedAt(),

                decision == null
                        ? null
                        : decisionResponse(
                                decision
                        )
        );
    }

    private CapitalReinvestmentDecisionResponse decisionResponse(
            CapitalRecyclingRepository.DecisionRow row
    ) {
        return new CapitalReinvestmentDecisionResponse(
                row.id(),
                row.proposalId(),
                row.decision(),
                row.decisionNote(),
                row.decidedByName(),
                row.decidedAt()
        );
    }

    private BigDecimal approvedAmount(
            UUID sourceId
    ) {
        return repository
                .proposals(
                        sourceId
                )
                .stream()
                .filter(
                        proposal -> {
                            CapitalRecyclingRepository.DecisionRow decision =
                                    repository
                                            .decision(
                                                    proposal.id()
                                            );

                            return decision != null
                                    &&
                                    decision.decision()
                                            == CapitalReinvestmentDecision.APPROVED;
                        }
                )
                .map(
                        CapitalRecyclingRepository.ProposalRow::
                                requestedReinvestmentAmount
                )
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

    private BigDecimal pendingAmount(
            UUID sourceId
    ) {
        return repository
                .proposals(
                        sourceId
                )
                .stream()
                .filter(
                        proposal ->
                                repository
                                        .decision(
                                                proposal.id()
                                        )
                                == null
                )
                .map(
                        CapitalRecyclingRepository.ProposalRow::
                                requestedReinvestmentAmount
                )
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

    private boolean hasPendingProposal(
            UUID sourceId
    ) {
        return repository
                .proposals(
                        sourceId
                )
                .stream()
                .anyMatch(
                        proposal ->
                                repository
                                        .decision(
                                                proposal.id()
                                        )
                                == null
                );
    }

    private CapitalRecyclingSummaryResponse summary(
            int candidateCount,
            List<CapitalRecyclingSourceResponse> sources
    ) {
        List<CapitalRecyclingSourceResponse> active =
                sources.stream()
                        .filter(
                                source ->
                                        source.status()
                                                != CapitalRecyclingSourceStatus.CLOSED
                        )
                        .toList();

        return new CapitalRecyclingSummaryResponse(
                candidateCount,
                active.size(),

                countStatus(
                        active,
                        CapitalRecyclingSourceStatus.OPEN
                ),

                countStatus(
                        active,
                        CapitalRecyclingSourceStatus.FULLY_ALLOCATED
                ),

                sum(
                        active.stream()
                                .map(
                                        CapitalRecyclingSourceResponse::
                                                recyclableCapitalAmount
                                )
                                .toList()
                ),

                sum(
                        active.stream()
                                .map(
                                        CapitalRecyclingSourceResponse::
                                                approvedReinvestmentAmount
                                )
                                .toList()
                ),

                sum(
                        active.stream()
                                .map(
                                        CapitalRecyclingSourceResponse::
                                                availableCapitalAmount
                                )
                                .toList()
                ),

                mathService.averageUtilization(
                        active.stream()
                                .map(
                                        CapitalRecyclingSourceResponse::
                                                utilizationPct
                                )
                                .toList()
                )
        );
    }

    private CapitalRecyclingSnapshotSummaryResponse snapshotSummary(
            CapitalRecyclingRepository.SnapshotRow row
    ) {
        return new CapitalRecyclingSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.sourceCount(),
                row.openSourceCount(),
                row.fullyAllocatedSourceCount(),
                mathService.money(
                        row.totalRecyclableCapitalAmount()
                ),
                mathService.money(
                        row.totalApprovedReinvestmentAmount()
                ),
                mathService.money(
                        row.totalAvailableCapitalAmount()
                ),
                mathService.percent(
                        row.averageUtilizationPct()
                ),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private CapitalRecyclingSnapshotItemResponse snapshotItemResponse(
            CapitalRecyclingRepository.SnapshotItemRow row
    ) {
        return new CapitalRecyclingSnapshotItemResponse(
                row.recyclingSourceId(),
                row.sourceNumber(),
                row.executionNumber(),
                row.sourceInitiativeTitle(),
                row.sourceAction(),
                row.currency(),
                row.sourceStatus(),
                mathService.money(
                        row.recyclableCapitalAmount()
                ),
                mathService.money(
                        row.approvedReinvestmentAmount()
                ),
                mathService.money(
                        row.pendingReinvestmentAmount()
                ),
                mathService.money(
                        row.availableCapitalAmount()
                ),
                mathService.percent(
                        row.utilizationPct()
                ),
                mathService.money(
                        row.currentFundingRemainingAmount()
                ),
                row.preferredTargetValueCaseNumber()
        );
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

    private CapitalRecyclingRepository.SourceRow requireSource(
            UUID sourceId
    ) {
        CapitalRecyclingRepository.SourceRow source =
                repository
                        .findSource(
                                sourceId
                        );

        if (source == null) {
            throw new ResourceNotFoundException(
                    "Capital-recycling source not found: "
                            + sourceId
            );
        }

        return source;
    }

    private CapitalRecyclingRepository.ProposalRow requireProposal(
            UUID proposalId
    ) {
        CapitalRecyclingRepository.ProposalRow proposal =
                repository
                        .findProposal(
                                proposalId
                        );

        if (proposal == null) {
            throw new ResourceNotFoundException(
                    "Capital-reinvestment proposal not found: "
                            + proposalId
            );
        }

        return proposal;
    }

    private AppUserEntity requireRecyclingUser(
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
                    "Requester accounts cannot own strategic capital-recycling governance."
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
            List<CapitalRecyclingSourceResponse> sources,
            CapitalRecyclingSourceStatus status
    ) {
        return (
                int
        ) sources.stream()
                .filter(
                        source ->
                                source.status()
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

    private String nextSourceNumber() {
        return String.format(
                "RECYCLE-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextSourceSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "RECSNAP-%d-%05d",
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
                    "Your ProcureIQ role cannot access capital-recycling governance."
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
                    "Your ProcureIQ role cannot manage capital-recycling governance."
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
                    "Only administrators and procurement managers can approve strategic capital reinvestment."
            );
        }
    }
}
