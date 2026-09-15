package com.procureiq.investmentintervention;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.fundingexecution.FundingCommitmentResponse;
import com.procureiq.fundingexecution.FundingExecutionService;
import com.procureiq.investmentperformance.InvestmentPerformanceCaseResponse;
import com.procureiq.investmentperformance.InvestmentPerformanceCaseStatus;
import com.procureiq.investmentperformance.InvestmentPerformanceDashboardResponse;
import com.procureiq.investmentperformance.InvestmentPerformanceHealth;
import com.procureiq.investmentperformance.InvestmentPerformanceService;
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
public class InvestmentInterventionService {

    private final InvestmentInterventionRepository repository;

    private final InvestmentInterventionMathService mathService;

    private final InvestmentPerformanceService investmentPerformanceService;

    private final FundingExecutionService fundingExecutionService;

    private final StrategicValueService strategicValueService;

    private final AppUserRepository appUserRepository;

    public InvestmentInterventionService(
            InvestmentInterventionRepository repository,
            InvestmentInterventionMathService mathService,
            InvestmentPerformanceService investmentPerformanceService,
            FundingExecutionService fundingExecutionService,
            StrategicValueService strategicValueService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.investmentPerformanceService =
                investmentPerformanceService;

        this.fundingExecutionService =
                fundingExecutionService;

        this.strategicValueService =
                strategicValueService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public InvestmentInterventionDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<InvestmentInterventionCandidateResponse> candidates =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                candidate ->
                                        repository
                                                .activeCaseForPerformance(
                                                        candidate.performanceCaseId()
                                                )
                                        == null
                        )
                        .toList();

        List<InvestmentInterventionCaseResponse> cases =
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

        return new InvestmentInterventionDashboardResponse(
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

    public InvestmentInterventionCaseDetailResponse createCase(
            UUID currentUserId,
            UUID performanceCaseId,
            InvestmentInterventionCaseInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .activeCaseForPerformance(
                                performanceCaseId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "An active intervention case already exists for this Step 59 performance case."
            );
        }

        InvestmentInterventionCandidateResponse candidate =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                source ->
                                        source
                                                .performanceCaseId()
                                                .equals(
                                                        performanceCaseId
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Performance case is not currently eligible for investment intervention."
                                        )
                        );

        AppUserEntity owner =
                requireInterventionUser(
                        input.interventionOwnerUserId()
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

        return interventionCase(
                currentUserId,
                caseId
        );
    }

    @Transactional(readOnly = true)
    public InvestmentInterventionCaseDetailResponse interventionCase(
            UUID currentUserId,
            UUID caseId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentInterventionRepository.CaseRow interventionCase =
                requireCase(
                        caseId
                );

        return new InvestmentInterventionCaseDetailResponse(
                caseResponse(
                        currentUserId,
                        interventionCase
                ),
                repository.users(),
                reallocationTargets(
                        currentUserId,
                        interventionCase
                ),
                repository
                        .proposals(
                                caseId
                        )
                        .stream()
                        .map(
                                this::proposalResponse
                        )
                        .toList()
        );
    }

    public InvestmentInterventionCaseDetailResponse proposeAction(
            UUID currentUserId,
            UUID caseId,
            InvestmentInterventionProposalInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentInterventionRepository.CaseRow interventionCase =
                requireCase(
                        caseId
                );

        if (
                interventionCase.status()
                        != InvestmentInterventionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "New intervention proposals can be created only while the case is OPEN."
            );
        }

        InvestmentInterventionRepository.ProposalRow latest =
                repository
                        .latestProposal(
                                caseId
                        );

        if (
                latest != null
                &&
                repository
                        .findDecision(
                                latest.id()
                        )
                == null
        ) {
            throw new IllegalArgumentException(
                    "The intervention case already has a proposal awaiting governance decision."
            );
        }

        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        interventionCase.fundingCommitmentId()
                );

        BigDecimal currentRemaining =
                mathService.money(
                        funding.remainingCommitmentAmount()
                );

        if (
                currentRemaining.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "No unreleased committed capital remains available for intervention."
            );
        }

        BigDecimal affected =
                mathService.money(
                        input.affectedCapitalAmount()
                );

        UUID targetValueCaseId =
                null;

        String targetValueCaseNumber =
                null;

        String targetInitiativeTitle =
                null;

        if (
                input.actionType()
                        == InvestmentInterventionAction.CONTINUE
        ) {
            if (
                    affected.compareTo(
                            BigDecimal.ZERO
                    )
                    != 0
            ) {
                throw new IllegalArgumentException(
                        "CONTINUE proposals must have zero affected capital."
                );
            }

            if (
                    input.targetValueCaseId()
                            != null
            ) {
                throw new IllegalArgumentException(
                        "CONTINUE proposals cannot define a reallocation target."
                );
            }
        } else {
            if (
                    affected.compareTo(
                            BigDecimal.ZERO
                    )
                    <= 0
            ) {
                throw new IllegalArgumentException(
                        "Capital intervention proposals require a positive affected amount."
                );
            }

            if (
                    affected.compareTo(
                            currentRemaining
                    )
                    > 0
            ) {
                throw new IllegalArgumentException(
                        "Intervention proposal cannot affect more than the currently unreleased committed capital."
                );
            }
        }

        if (
                input.actionType()
                        == InvestmentInterventionAction.REALLOCATE_UNRELEASED
        ) {
            if (
                    input.targetValueCaseId()
                            == null
            ) {
                throw new IllegalArgumentException(
                        "REALLOCATE_UNRELEASED requires a governed Step 56 target value case."
                );
            }

            StrategicValueCaseResponse target =
                    validateReallocationTarget(
                            currentUserId,
                            interventionCase,
                            input.targetValueCaseId()
                    );

            targetValueCaseId =
                    target.id();

            targetValueCaseNumber =
                    target.caseNumber();

            targetInitiativeTitle =
                    target.initiativeTitle();
        } else if (
                input.targetValueCaseId()
                        != null
        ) {
            throw new IllegalArgumentException(
                    "Only REALLOCATE_UNRELEASED proposals may define a target value case."
            );
        }

        repository.createProposal(
                UUID.randomUUID(),
                caseId,
                input,
                currentRemaining,
                targetValueCaseId,
                targetValueCaseNumber,
                targetInitiativeTitle,
                currentUserId
        );

        return interventionCase(
                currentUserId,
                caseId
        );
    }

    public InvestmentInterventionCaseDetailResponse submitForReview(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentInterventionRepository.CaseRow interventionCase =
                requireCase(
                        caseId
                );

        if (
                interventionCase.status()
                        != InvestmentInterventionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only an OPEN intervention case can be submitted for review."
            );
        }

        InvestmentInterventionRepository.ProposalRow latest =
                repository
                        .latestProposal(
                                caseId
                        );

        if (latest == null) {
            throw new IllegalArgumentException(
                    "An immutable intervention proposal is required before review."
            );
        }

        if (
                repository
                        .findDecision(
                                latest.id()
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "The latest intervention proposal already has a governance decision."
            );
        }

        validateProposalAgainstCurrentCapital(
                currentUserId,
                interventionCase,
                latest
        );

        repository.markInReview(
                caseId
        );

        return interventionCase(
                currentUserId,
                caseId
        );
    }

    public InvestmentInterventionCaseDetailResponse decideProposal(
            UUID currentUserId,
            UUID caseId,
            InvestmentInterventionDecisionInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentInterventionRepository.CaseRow interventionCase =
                requireCase(
                        caseId
                );

        if (
                interventionCase.status()
                        != InvestmentInterventionStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Intervention case is not currently IN_REVIEW."
            );
        }

        InvestmentInterventionRepository.ProposalRow proposal =
                repository
                        .latestProposal(
                                caseId
                        );

        if (proposal == null) {
            throw new IllegalArgumentException(
                    "Intervention case does not contain a proposal."
            );
        }

        if (
                repository
                        .findDecision(
                                proposal.id()
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "Intervention proposal already has an immutable governance decision."
            );
        }

        if (
                input.decision()
                        == InvestmentInterventionDecision.APPROVED
        ) {
            validateProposalAgainstCurrentCapital(
                    currentUserId,
                    interventionCase,
                    proposal
            );

            if (
                    proposal.actionType()
                            == InvestmentInterventionAction.REALLOCATE_UNRELEASED
            ) {
                validateReallocationTarget(
                        currentUserId,
                        interventionCase,
                        proposal.targetValueCaseId()
                );
            }
        }

        repository.createDecision(
                UUID.randomUUID(),
                caseId,
                proposal.id(),
                input,
                currentUserId
        );

        if (
                input.decision()
                        == InvestmentInterventionDecision.APPROVED
        ) {
            repository.markApproved(
                    caseId
            );
        } else {
            repository.returnToOpen(
                    caseId
            );
        }

        InvestmentInterventionCaseDetailResponse result =
                interventionCase(
                        currentUserId,
                        caseId
                );

        if (
                input.decision()
                        == InvestmentInterventionDecision.APPROVED
        ) {
            captureSnapshotInternal(
                    currentUserId
            );
        }

        return result;
    }

    public InvestmentInterventionCaseDetailResponse closeCase(
            UUID currentUserId,
            UUID caseId,
            InvestmentInterventionNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentInterventionRepository.CaseRow interventionCase =
                requireCase(
                        caseId
                );

        if (
                interventionCase.status()
                        != InvestmentInterventionStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Only an approved intervention case can be closed."
            );
        }

        repository.closeCase(
                caseId,
                input.note(),
                currentUserId
        );

        InvestmentInterventionCaseDetailResponse result =
                interventionCase(
                        currentUserId,
                        caseId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public InvestmentInterventionSnapshotDetailResponse captureSnapshot(
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
    public InvestmentInterventionSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentInterventionRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Investment-intervention snapshot not found: "
                            + snapshotId
            );
        }

        return new InvestmentInterventionSnapshotDetailResponse(
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

    private InvestmentInterventionSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId
    ) {
        List<InvestmentInterventionCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .filter(
                                interventionCase ->
                                        interventionCase.status()
                                                != InvestmentInterventionStatus.CLOSED
                        )
                        .map(
                                row ->
                                        caseResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        InvestmentInterventionSummaryResponse summary =
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
                InvestmentInterventionCaseResponse interventionCase
                : cases
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    interventionCase
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<InvestmentInterventionCandidateResponse> sourceCandidates(
            UUID currentUserId
    ) {
        InvestmentPerformanceDashboardResponse performanceDashboard =
                investmentPerformanceService
                        .dashboard(
                                currentUserId
                        );

        return performanceDashboard
                .cases()
                .stream()
                .filter(
                        InvestmentPerformanceCaseResponse::
                                assessed
                )
                .filter(
                        performanceCase ->
                                performanceCase.status()
                                        != InvestmentPerformanceCaseStatus.CLOSED
                )
                .map(
                        performanceCase ->
                                candidateResponse(
                                        currentUserId,
                                        performanceCase
                                )
                )
                .filter(
                        candidate ->
                                candidate
                                        .remainingCommitmentAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        )
                                > 0
                )
                .toList();
    }

    private InvestmentInterventionCandidateResponse candidateResponse(
            UUID currentUserId,
            InvestmentPerformanceCaseResponse performanceCase
    ) {
        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        performanceCase.fundingCommitmentId()
                );

        InvestmentInterventionRecommendationResult recommendation =
                mathService
                        .recommend(
                                performanceCase.health(),
                                performanceCase.roiVariancePct(),
                                performanceCase.capitalEfficiencyMultiple(),
                                funding.remainingCommitmentAmount()
                        );

        return new InvestmentInterventionCandidateResponse(
                performanceCase.id(),
                performanceCase.performanceCaseNumber(),
                performanceCase.status(),
                performanceCase.health(),

                funding.id(),
                funding.commitmentNumber(),

                performanceCase.valueCaseId(),
                performanceCase.valueCaseNumber(),

                performanceCase.initiativeNumber(),
                performanceCase.initiativeTitle(),
                performanceCase.currency(),
                performanceCase.fiscalYear(),

                mathService.money(
                        funding.releasedAmount()
                ),
                mathService.money(
                        funding.remainingCommitmentAmount()
                ),

                mathService.decimal(
                        performanceCase.baselineRoiPct()
                ),
                mathService.decimal(
                        performanceCase.realizedRoiPct()
                ),
                mathService.decimal(
                        performanceCase.roiVariancePct()
                ),
                mathService.multiple(
                        performanceCase.capitalEfficiencyMultiple()
                ),
                mathService.money(
                        performanceCase.valueVarianceAmount()
                ),

                recommendation.action(),
                recommendation.recommendedAffectedCapitalAmount()
        );
    }

    private InvestmentInterventionCaseResponse caseResponse(
            UUID currentUserId,
            InvestmentInterventionRepository.CaseRow row
    ) {
        InvestmentPerformanceCaseResponse performanceCase =
                currentPerformanceCase(
                        currentUserId,
                        row.performanceCaseId()
                );

        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        row.fundingCommitmentId()
                );

        InvestmentInterventionRecommendationResult recommendation =
                mathService
                        .recommend(
                                performanceCase.health(),
                                performanceCase.roiVariancePct(),
                                performanceCase.capitalEfficiencyMultiple(),
                                funding.remainingCommitmentAmount()
                        );

        InvestmentInterventionRepository.ProposalRow approved =
                approvedProposal(
                        row.id()
                );

        BigDecimal approvedAffected =
                approved == null
                        ? BigDecimal.ZERO
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                )
                        : mathService.money(
                                approved.affectedCapitalAmount()
                        );

        return new InvestmentInterventionCaseResponse(
                row.id(),
                row.interventionNumber(),

                row.performanceCaseId(),
                row.performanceCaseNumber(),

                row.fundingCommitmentId(),
                row.fundingCommitmentNumber(),

                row.valueCaseId(),
                row.valueCaseNumber(),

                row.initiativeNumber(),
                row.initiativeTitle(),
                row.currency(),
                row.fiscalYear(),

                row.interventionOwnerUserId(),
                row.interventionOwnerName(),
                row.interventionRationale(),

                row.sourcePerformanceStatus(),
                row.sourcePerformanceHealth(),
                mathService.money(
                        row.sourceReleasedCapitalAmount()
                ),
                mathService.money(
                        row.sourceRemainingCommitmentAmount()
                ),
                mathService.decimal(
                        row.sourceBaselineRoiPct()
                ),
                mathService.decimal(
                        row.sourceRealizedRoiPct()
                ),
                mathService.decimal(
                        row.sourceRoiVariancePct()
                ),
                mathService.multiple(
                        row.sourceCapitalEfficiencyMultiple()
                ),
                mathService.money(
                        row.sourceValueVarianceAmount()
                ),

                performanceCase.status(),
                performanceCase.health(),
                mathService.money(
                        funding.releasedAmount()
                ),
                mathService.money(
                        funding.remainingCommitmentAmount()
                ),
                mathService.decimal(
                        performanceCase.realizedRoiPct()
                ),
                mathService.decimal(
                        performanceCase.roiVariancePct()
                ),
                mathService.multiple(
                        performanceCase.capitalEfficiencyMultiple()
                ),
                mathService.money(
                        performanceCase.valueVarianceAmount()
                ),

                recommendation.action(),
                recommendation.recommendedAffectedCapitalAmount(),

                approved == null
                        ? null
                        : approved.actionType(),
                approvedAffected,
                approved == null
                        ? null
                        : approved.targetValueCaseNumber(),

                row.status(),
                repository
                        .proposals(
                                row.id()
                        )
                        .size(),
                repository
                        .decisions(
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

    private InvestmentInterventionProposalResponse proposalResponse(
            InvestmentInterventionRepository.ProposalRow row
    ) {
        InvestmentInterventionRepository.DecisionRow decision =
                repository
                        .findDecision(
                                row.id()
                        );

        return new InvestmentInterventionProposalResponse(
                row.id(),
                row.interventionCaseId(),
                row.actionType(),
                mathService.money(
                        row.sourceRemainingCapitalSnapshot()
                ),
                mathService.money(
                        row.affectedCapitalAmount()
                ),
                row.targetValueCaseId(),
                row.targetValueCaseNumber(),
                row.targetInitiativeTitle(),
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

    private InvestmentInterventionDecisionResponse decisionResponse(
            InvestmentInterventionRepository.DecisionRow row
    ) {
        return new InvestmentInterventionDecisionResponse(
                row.id(),
                row.proposalId(),
                row.decision(),
                row.decisionNote(),
                row.decidedByName(),
                row.decidedAt()
        );
    }

    private InvestmentInterventionRepository.ProposalRow approvedProposal(
            UUID caseId
    ) {
        return repository
                .proposals(
                        caseId
                )
                .stream()
                .filter(
                        proposal -> {
                            InvestmentInterventionRepository.DecisionRow decision =
                                    repository
                                            .findDecision(
                                                    proposal.id()
                                            );

                            return decision != null
                                    &&
                                    decision.decision()
                                            == InvestmentInterventionDecision.APPROVED;
                        }
                )
                .findFirst()
                .orElse(null);
    }

    private List<StrategicValueCaseResponse> reallocationTargets(
            UUID currentUserId,
            InvestmentInterventionRepository.CaseRow interventionCase
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
                                !target.id()
                                        .equals(
                                                interventionCase.valueCaseId()
                                        )
                )
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
                                target.currency()
                                        .equalsIgnoreCase(
                                                interventionCase.currency()
                                        )
                )
                .filter(
                        target ->
                                target.fiscalYear()
                                        == interventionCase.fiscalYear()
                )
                .filter(
                        target ->
                                target.valueHealth()
                                        != StrategicValueHealth.AT_RISK
                                &&
                                target.valueHealth()
                                        != StrategicValueHealth.UNASSESSED
                )
                .toList();
    }

    private StrategicValueCaseResponse validateReallocationTarget(
            UUID currentUserId,
            InvestmentInterventionRepository.CaseRow interventionCase,
            UUID targetValueCaseId
    ) {
        if (targetValueCaseId == null) {
            throw new IllegalArgumentException(
                    "Reallocation target is required."
            );
        }

        if (
                targetValueCaseId.equals(
                        interventionCase.valueCaseId()
                )
        ) {
            throw new IllegalArgumentException(
                    "Reallocation target cannot be the source investment itself."
            );
        }

        StrategicValueCaseResponse target =
                currentValueCase(
                        currentUserId,
                        targetValueCaseId
                );

        if (
                target.status()
                        != StrategicValueCaseStatus.VERIFIED
                &&
                target.status()
                        != StrategicValueCaseStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Reallocation target must be a verified or closed Step 56 value case."
            );
        }

        if (
                !target.currency()
                        .equalsIgnoreCase(
                                interventionCase.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Reallocation target currency must match the source intervention currency."
            );
        }

        if (
                target.fiscalYear()
                        != interventionCase.fiscalYear()
        ) {
            throw new IllegalArgumentException(
                    "Reallocation target fiscal year must match the source intervention fiscal year."
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
                    "Reallocation target cannot be an unassessed or at-risk Step 56 value case."
            );
        }

        return target;
    }

    private void validateProposalAgainstCurrentCapital(
            UUID currentUserId,
            InvestmentInterventionRepository.CaseRow interventionCase,
            InvestmentInterventionRepository.ProposalRow proposal
    ) {
        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        interventionCase.fundingCommitmentId()
                );

        BigDecimal remaining =
                mathService.money(
                        funding.remainingCommitmentAmount()
                );

        if (
                proposal.actionType()
                        == InvestmentInterventionAction.CONTINUE
        ) {
            return;
        }

        if (
                remaining.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "No unreleased committed capital remains available for this intervention."
            );
        }

        if (
                mathService.money(
                        proposal.affectedCapitalAmount()
                )
                        .compareTo(
                                remaining
                        )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Proposed intervention now exceeds the current unreleased committed capital."
            );
        }
    }

    private InvestmentPerformanceCaseResponse currentPerformanceCase(
            UUID currentUserId,
            UUID performanceCaseId
    ) {
        return investmentPerformanceService
                .performanceCase(
                        currentUserId,
                        performanceCaseId
                )
                .performanceCase();
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

    private StrategicValueCaseResponse currentValueCase(
            UUID currentUserId,
            UUID valueCaseId
    ) {
        return strategicValueService
                .valueCase(
                        currentUserId,
                        valueCaseId
                )
                .valueCase();
    }

    private InvestmentInterventionSummaryResponse summary(
            int candidateCount,
            List<InvestmentInterventionCaseResponse> cases
    ) {
        List<InvestmentInterventionCaseResponse> active =
                cases.stream()
                        .filter(
                                interventionCase ->
                                        interventionCase.status()
                                                != InvestmentInterventionStatus.CLOSED
                        )
                        .toList();

        BigDecimal remainingCapital =
                sum(
                        active.stream()
                                .map(
                                        InvestmentInterventionCaseResponse::
                                                currentRemainingCommitmentAmount
                                )
                                .toList()
                );

        BigDecimal approvedAffected =
                sum(
                        active.stream()
                                .filter(
                                        interventionCase ->
                                                interventionCase.status()
                                                        == InvestmentInterventionStatus.APPROVED
                                )
                                .map(
                                        InvestmentInterventionCaseResponse::
                                                approvedAffectedCapitalAmount
                                )
                                .toList()
                );

        BigDecimal approvedReallocation =
                sum(
                        active.stream()
                                .filter(
                                        interventionCase ->
                                                interventionCase.status()
                                                        == InvestmentInterventionStatus.APPROVED
                                )
                                .filter(
                                        interventionCase ->
                                                interventionCase.approvedAction()
                                                        == InvestmentInterventionAction.REALLOCATE_UNRELEASED
                                )
                                .map(
                                        InvestmentInterventionCaseResponse::
                                                approvedAffectedCapitalAmount
                                )
                                .toList()
                );

        return new InvestmentInterventionSummaryResponse(
                candidateCount,
                active.size(),

                countStatus(
                        active,
                        InvestmentInterventionStatus.OPEN
                ),

                countStatus(
                        active,
                        InvestmentInterventionStatus.IN_REVIEW
                ),

                countStatus(
                        active,
                        InvestmentInterventionStatus.APPROVED
                ),

                (
                        int
                ) active.stream()
                        .filter(
                                interventionCase ->
                                        interventionCase.currentPerformanceHealth()
                                                == InvestmentPerformanceHealth.UNDERPERFORMING
                        )
                        .count(),

                remainingCapital,
                approvedAffected,
                approvedReallocation
        );
    }

    private InvestmentInterventionSnapshotSummaryResponse snapshotSummary(
            InvestmentInterventionRepository.SnapshotRow row
    ) {
        return new InvestmentInterventionSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.caseCount(),
                row.openCaseCount(),
                row.inReviewCaseCount(),
                row.approvedCaseCount(),
                row.underperformingCaseCount(),
                mathService.money(
                        row.totalRemainingCapitalAmount()
                ),
                mathService.money(
                        row.totalApprovedAffectedCapitalAmount()
                ),
                mathService.money(
                        row.totalApprovedReallocationAmount()
                ),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private InvestmentInterventionSnapshotItemResponse snapshotItemResponse(
            InvestmentInterventionRepository.SnapshotItemRow row
    ) {
        return new InvestmentInterventionSnapshotItemResponse(
                row.interventionCaseId(),
                row.interventionNumber(),
                row.performanceCaseNumber(),
                row.fundingCommitmentNumber(),
                row.valueCaseNumber(),
                row.initiativeTitle(),
                row.currency(),
                row.caseStatus(),
                row.currentPerformanceHealth(),
                mathService.money(
                        row.currentReleasedCapitalAmount()
                ),
                mathService.money(
                        row.currentRemainingCommitmentAmount()
                ),
                mathService.decimal(
                        row.currentRealizedRoiPct()
                ),
                mathService.decimal(
                        row.currentRoiVariancePct()
                ),
                mathService.multiple(
                        row.currentCapitalEfficiencyMultiple()
                ),
                mathService.money(
                        row.currentValueVarianceAmount()
                ),
                row.recommendedAction(),
                row.approvedAction(),
                mathService.money(
                        row.approvedAffectedCapitalAmount()
                ),
                row.approvedTargetValueCaseNumber()
        );
    }

    private InvestmentInterventionRepository.CaseRow requireCase(
            UUID caseId
    ) {
        InvestmentInterventionRepository.CaseRow interventionCase =
                repository
                        .findCase(
                                caseId
                        );

        if (interventionCase == null) {
            throw new ResourceNotFoundException(
                    "Investment-intervention case not found: "
                            + caseId
            );
        }

        return interventionCase;
    }

    private AppUserEntity requireInterventionUser(
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
                    "Requester accounts cannot own investment-intervention governance."
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
            List<InvestmentInterventionCaseResponse> cases,
            InvestmentInterventionStatus status
    ) {
        return (
                int
        ) cases.stream()
                .filter(
                        interventionCase ->
                                interventionCase.status()
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
                "INTV-%d-%05d",
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
                "INTVSNAP-%d-%05d",
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
                    "Your ProcureIQ role cannot access investment-intervention governance."
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
                    "Your ProcureIQ role cannot manage investment-intervention planning."
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
                    "Only administrators and procurement managers can approve investment interventions."
            );
        }
    }
}
