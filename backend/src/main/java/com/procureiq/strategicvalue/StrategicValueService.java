package com.procureiq.strategicvalue;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.outcomepersistence.OutcomePersistenceDashboardResponse;
import com.procureiq.outcomepersistence.OutcomePersistenceService;
import com.procureiq.outcomepersistence.PersistenceHealth;
import com.procureiq.outcomepersistence.PersistencePlanResponse;
import com.procureiq.outcomepersistence.PersistencePlanStatus;
import com.procureiq.strategyexecution.ExecutionCommitmentResponse;
import com.procureiq.strategyexecution.ExecutionCommitmentStatus;
import com.procureiq.strategyexecution.StrategyExecutionService;
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
public class StrategicValueService {

    private final StrategicValueRepository repository;

    private final StrategicValueMathService mathService;

    private final OutcomePersistenceService outcomePersistenceService;

    private final StrategyExecutionService strategyExecutionService;

    private final AppUserRepository appUserRepository;

    public StrategicValueService(
            StrategicValueRepository repository,
            StrategicValueMathService mathService,
            OutcomePersistenceService outcomePersistenceService,
            StrategyExecutionService strategyExecutionService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.outcomePersistenceService =
                outcomePersistenceService;

        this.strategyExecutionService =
                strategyExecutionService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public StrategicValueDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        OutcomePersistenceDashboardResponse persistence =
                outcomePersistenceService
                        .dashboard(
                                currentUserId
                        );

        List<StrategicValueCandidateResponse> candidates =
                persistence
                        .plans()
                        .stream()
                        .filter(
                                this::eligiblePersistencePlan
                        )
                        .filter(
                                plan ->
                                        repository
                                                .activeCaseForPersistencePlan(
                                                        plan.id()
                                                )
                                        == null
                        )
                        .map(
                                plan ->
                                        candidateResponse(
                                                currentUserId,
                                                plan
                                        )
                        )
                        .toList();

        List<StrategicValueCaseResponse> cases =
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

        return new StrategicValueDashboardResponse(
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

    public StrategicValueCaseDetailResponse createCase(
            UUID currentUserId,
            UUID persistencePlanId,
            StrategicValueCaseInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .activeCaseForPersistencePlan(
                                persistencePlanId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "An active strategic value case already exists for this persistence plan."
            );
        }

        PersistencePlanResponse persistencePlan =
                currentPersistencePlan(
                        currentUserId,
                        persistencePlanId
                );

        if (
                !eligiblePersistencePlan(
                        persistencePlan
                )
        ) {
            throw new IllegalArgumentException(
                    "Persistence plan must be independently assessed and sustained before strategic ROI governance."
            );
        }

        ExecutionCommitmentResponse commitment =
                currentCommitment(
                        currentUserId,
                        persistencePlan.commitmentId()
                );

        if (
                commitment.status()
                        != ExecutionCommitmentStatus.COMPLETED
        ) {
            throw new IllegalArgumentException(
                    "Strategic value cases require a completed Step 53 execution commitment."
            );
        }

        if (
                commitment
                        .validatedContributionPoints()
                        .compareTo(
                                BigDecimal.ZERO
                        )
                <= 0
        ) {
            throw new IllegalArgumentException(
                    "Strategic value cases require positive Step 53 validated contribution."
            );
        }

        AppUserEntity valueOwner =
                requireValueUser(
                        input.valueOwnerUserId()
                );

        repository.createCase(
                UUID.randomUUID(),
                nextCaseNumber(),
                persistencePlan.id(),
                persistencePlan.planNumber(),
                commitment.id(),
                commitment.commitmentNumber(),
                commitment.sourceRoadmapId(),
                commitment.sourceRoadmapNumber(),
                commitment.sourceInitiativeNumber(),
                commitment.sourceInitiativeTitle(),
                input.valueOwnerUserId(),
                valueOwner.getFullName(),
                commitment.currency(),
                commitment.fiscalYear(),
                commitment.validatedContributionPoints(),
                persistencePlan.baselineValidatedContributionPoints(),
                input,
                currentUserId
        );

        StrategicValueRepository.CaseRow created =
                repository
                        .activeCaseForPersistencePlan(
                                persistencePlanId
                        );

        if (created == null) {
            throw new IllegalStateException(
                    "Strategic value case creation did not produce a retrievable case."
            );
        }

        return valueCase(
                currentUserId,
                created.id()
        );
    }

    @Transactional(readOnly = true)
    public StrategicValueCaseDetailResponse valueCase(
            UUID currentUserId,
            UUID caseId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new StrategicValueCaseDetailResponse(
                caseResponse(
                        currentUserId,
                        requireCase(
                                caseId
                        )
                )
        );
    }

    public StrategicValueCaseDetailResponse submitForReview(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicValueRepository.CaseRow valueCase =
                requireCase(
                        caseId
                );

        if (
                valueCase.status()
                        != StrategicValueCaseStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Only an active strategic value case can be submitted for review."
            );
        }

        PersistencePlanResponse persistencePlan =
                currentPersistencePlan(
                        currentUserId,
                        valueCase.persistencePlanId()
                );

        if (
                !eligiblePersistencePlan(
                        persistencePlan
                )
        ) {
            throw new IllegalArgumentException(
                    "Persistence authority is no longer eligible for strategic value verification."
            );
        }

        repository.markReadyForReview(
                caseId
        );

        return valueCase(
                currentUserId,
                caseId
        );
    }

    public StrategicValueCaseDetailResponse verifyCase(
            UUID currentUserId,
            UUID caseId,
            StrategicValueNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicValueRepository.CaseRow valueCase =
                requireCase(
                        caseId
                );

        if (
                valueCase.status()
                        != StrategicValueCaseStatus.READY_FOR_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only a strategic value case ready for review can be verified."
            );
        }

        PersistencePlanResponse persistencePlan =
                currentPersistencePlan(
                        currentUserId,
                        valueCase.persistencePlanId()
                );

        if (
                !eligiblePersistencePlan(
                        persistencePlan
                )
        ) {
            throw new IllegalArgumentException(
                    "Current persistence evidence does not permit strategic value verification."
            );
        }

        repository.verifyCase(
                caseId,
                input.note(),
                currentUserId
        );

        return valueCase(
                currentUserId,
                caseId
        );
    }

    public StrategicValueCaseDetailResponse closeCase(
            UUID currentUserId,
            UUID caseId,
            StrategicValueNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicValueRepository.CaseRow valueCase =
                requireCase(
                        caseId
                );

        if (
                valueCase.status()
                        != StrategicValueCaseStatus.VERIFIED
        ) {
            throw new IllegalArgumentException(
                    "Only a verified strategic value case can be closed."
            );
        }

        repository.closeCase(
                caseId,
                input.note(),
                currentUserId
        );

        return valueCase(
                currentUserId,
                caseId
        );
    }

    public StrategicValueReviewDetailResponse captureReview(
            UUID currentUserId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<StrategicValueCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .filter(
                                row ->
                                        row.status()
                                                != StrategicValueCaseStatus.CLOSED
                        )
                        .map(
                                row ->
                                        caseResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        StrategicValueSummaryResponse summary =
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
                StrategicValueCaseResponse valueCase
                : cases
        ) {
            repository.createReviewItem(
                    reviewId,
                    valueCase
            );
        }

        return review(
                currentUserId,
                reviewId
        );
    }

    @Transactional(readOnly = true)
    public StrategicValueReviewDetailResponse review(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicValueRepository.ReviewRow review =
                repository
                        .findReview(
                                reviewId
                        );

        if (review == null) {
            throw new ResourceNotFoundException(
                    "Strategic value review not found: "
                            + reviewId
            );
        }

        return new StrategicValueReviewDetailResponse(
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

    private StrategicValueCandidateResponse candidateResponse(
            UUID currentUserId,
            PersistencePlanResponse persistencePlan
    ) {
        ExecutionCommitmentResponse commitment =
                currentCommitment(
                        currentUserId,
                        persistencePlan.commitmentId()
                );

        return new StrategicValueCandidateResponse(
                persistencePlan.id(),
                persistencePlan.planNumber(),
                commitment.id(),
                commitment.commitmentNumber(),
                commitment.sourceRoadmapId(),
                commitment.sourceRoadmapNumber(),
                commitment.sourceInitiativeNumber(),
                commitment.sourceInitiativeTitle(),
                commitment.ownerName(),
                persistencePlan.persistenceOwnerName(),
                commitment.currency(),
                commitment.fiscalYear(),
                mathService
                        .decimal(
                                commitment.validatedContributionPoints()
                        ),
                mathService
                        .decimal(
                                persistencePlan.baselineValidatedContributionPoints()
                        ),
                mathService
                        .decimal(
                                persistencePlan.currentValidatedContributionPoints()
                        ),
                mathService
                        .boundedPercent(
                                persistencePlan.persistencePct()
                        ),
                mathService
                        .decimal(
                                persistencePlan.decayPoints()
                        ),
                persistencePlan.persistenceHealth(),
                persistencePlan.status()
        );
    }

    private StrategicValueCaseResponse caseResponse(
            UUID currentUserId,
            StrategicValueRepository.CaseRow row
    ) {
        PersistencePlanResponse persistencePlan =
                currentPersistencePlan(
                        currentUserId,
                        row.persistencePlanId()
                );

        ExecutionCommitmentResponse commitment =
                currentCommitment(
                        currentUserId,
                        row.commitmentId()
                );

        StrategicValueMetricResult metric =
                mathService
                        .metrics(
                                row.investmentCostAmount(),
                                row.annualOperatingCostAmount(),
                                row.annualizedValueAmount(),
                                row.valueHorizonMonths(),
                                persistencePlan.persistencePct(),
                                row.targetRoiPct(),
                                row.targetPaybackMonths()
                        );

        return new StrategicValueCaseResponse(
                row.id(),
                row.caseNumber(),
                row.persistencePlanId(),
                row.persistencePlanNumber(),
                row.commitmentId(),
                row.commitmentNumber(),
                row.roadmapId(),
                row.roadmapNumber(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                row.valueOwnerUserId(),
                row.valueOwnerName(),
                row.currency(),
                row.fiscalYear(),

                mathService
                        .decimal(
                                commitment.validatedContributionPoints()
                        ),
                mathService
                        .decimal(
                                row.persistenceBaselinePoints()
                        ),
                mathService
                        .decimal(
                                persistencePlan.currentValidatedContributionPoints()
                        ),
                metric.persistencePct(),
                mathService
                        .decimal(
                                persistencePlan.decayPoints()
                        ),
                persistencePlan.persistenceHealth(),
                persistencePlan.status(),

                mathService
                        .money(
                                row.investmentCostAmount()
                        ),
                mathService
                        .money(
                                row.annualOperatingCostAmount()
                        ),
                mathService
                        .money(
                                row.annualizedValueAmount()
                        ),
                row.valueHorizonMonths(),
                mathService
                        .decimal(
                                row.targetRoiPct()
                        ),
                mathService
                        .decimal(
                                row.targetPaybackMonths()
                        ),
                row.valuationNote(),

                metric.baselineHorizonValueAmount(),
                metric.durableAnnualValueAmount(),
                metric.durableHorizonValueAmount(),
                metric.decayedValueAmount(),
                metric.operatingCostHorizonAmount(),
                metric.totalCostAmount(),
                metric.netValueAmount(),
                metric.roiPct(),
                metric.paybackMonths(),
                metric.valueAtRiskAmount(),
                metric.health(),

                row.status(),
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

    private StrategicValueSummaryResponse summary(
            int candidateCount,
            List<StrategicValueCaseResponse> cases
    ) {
        List<StrategicValueCaseResponse> active =
                cases.stream()
                        .filter(
                                valueCase ->
                                        valueCase.status()
                                                != StrategicValueCaseStatus.CLOSED
                        )
                        .toList();

        BigDecimal totalInvestment =
                sum(
                        active.stream()
                                .map(
                                        StrategicValueCaseResponse::
                                                investmentCostAmount
                                )
                                .toList()
                );

        BigDecimal totalAnnualOperatingCost =
                sum(
                        active.stream()
                                .map(
                                        StrategicValueCaseResponse::
                                                annualOperatingCostAmount
                                )
                                .toList()
                );

        BigDecimal totalBaselineValue =
                sum(
                        active.stream()
                                .map(
                                        StrategicValueCaseResponse::
                                                baselineHorizonValueAmount
                                )
                                .toList()
                );

        BigDecimal totalDurableAnnualValue =
                sum(
                        active.stream()
                                .map(
                                        StrategicValueCaseResponse::
                                                durableAnnualValueAmount
                                )
                                .toList()
                );

        BigDecimal totalDurableHorizonValue =
                sum(
                        active.stream()
                                .map(
                                        StrategicValueCaseResponse::
                                                durableHorizonValueAmount
                                )
                                .toList()
                );

        BigDecimal totalDecayedValue =
                sum(
                        active.stream()
                                .map(
                                        StrategicValueCaseResponse::
                                                decayedValueAmount
                                )
                                .toList()
                );

        BigDecimal totalCost =
                sum(
                        active.stream()
                                .map(
                                        StrategicValueCaseResponse::
                                                totalCostAmount
                                )
                                .toList()
                );

        BigDecimal totalNetValue =
                sum(
                        active.stream()
                                .map(
                                        StrategicValueCaseResponse::
                                                netValueAmount
                                )
                                .toList()
                );

        BigDecimal totalValueAtRisk =
                sum(
                        active.stream()
                                .map(
                                        StrategicValueCaseResponse::
                                                valueAtRiskAmount
                                )
                                .toList()
                );

        BigDecimal portfolioRoi =
                mathService
                        .portfolioRoi(
                                totalNetValue,
                                totalCost
                        );

        BigDecimal portfolioPayback =
                mathService
                        .portfolioPaybackMonths(
                                totalInvestment,
                                totalDurableAnnualValue,
                                totalAnnualOperatingCost
                        );

        StrategicValueHealth portfolioHealth =
                mathService
                        .portfolioHealth(
                                portfolioRoi,
                                active.stream()
                                        .map(
                                                StrategicValueCaseResponse::
                                                        valueHealth
                                        )
                                        .toList()
                        );

        return new StrategicValueSummaryResponse(
                candidateCount,
                active.size(),

                (
                        int
                ) active.stream()
                        .filter(
                                valueCase ->
                                        valueCase.status()
                                                == StrategicValueCaseStatus.VERIFIED
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                valueCase ->
                                        valueCase.valueHealth()
                                                == StrategicValueHealth.STRONG
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                valueCase ->
                                        valueCase.valueHealth()
                                                == StrategicValueHealth.HEALTHY
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                valueCase ->
                                        valueCase.valueHealth()
                                                == StrategicValueHealth.WATCH
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                valueCase ->
                                        valueCase.valueHealth()
                                                == StrategicValueHealth.AT_RISK
                        )
                        .count(),

                totalInvestment,
                totalAnnualOperatingCost,
                totalBaselineValue,
                totalDurableAnnualValue,
                totalDurableHorizonValue,
                totalDecayedValue,
                totalCost,
                totalNetValue,
                totalValueAtRisk,
                portfolioRoi,
                portfolioPayback,
                portfolioHealth
        );
    }

    private StrategicValueReviewSummaryResponse reviewSummary(
            StrategicValueRepository.ReviewRow row
    ) {
        return new StrategicValueReviewSummaryResponse(
                row.id(),
                row.reviewNumber(),
                row.caseCount(),
                row.verifiedCaseCount(),
                row.atRiskCaseCount(),
                row.watchCaseCount(),
                row.strongCaseCount(),
                mathService
                        .money(
                                row.totalInvestmentAmount()
                        ),
                mathService
                        .money(
                                row.totalOperatingCostAmount()
                        ),
                mathService
                        .money(
                                row.totalBaselineHorizonValueAmount()
                        ),
                mathService
                        .money(
                                row.totalDurableHorizonValueAmount()
                        ),
                mathService
                        .money(
                                row.totalDecayedValueAmount()
                        ),
                mathService
                        .money(
                                row.totalCostAmount()
                        ),
                mathService
                        .money(
                                row.totalNetValueAmount()
                        ),
                mathService
                        .decimal(
                                row.portfolioRoiPct()
                        ),
                row.portfolioPaybackMonths() == null
                        ? null
                        : mathService
                                .decimal(
                                        row.portfolioPaybackMonths()
                                ),
                row.portfolioHealth(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private StrategicValueReviewItemResponse reviewItemResponse(
            StrategicValueRepository.ReviewItemRow row
    ) {
        return new StrategicValueReviewItemResponse(
                row.valueCaseId(),
                row.caseNumber(),
                row.persistencePlanNumber(),
                row.commitmentNumber(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                row.valueOwnerName(),
                row.caseStatus(),
                row.currency(),
                mathService.money(
                        row.investmentCostAmount()
                ),
                mathService.money(
                        row.annualOperatingCostAmount()
                ),
                mathService.money(
                        row.annualizedValueAmount()
                ),
                mathService.boundedPercent(
                        row.persistencePct()
                ),
                mathService.money(
                        row.baselineHorizonValueAmount()
                ),
                mathService.money(
                        row.durableHorizonValueAmount()
                ),
                mathService.money(
                        row.decayedValueAmount()
                ),
                mathService.money(
                        row.totalCostAmount()
                ),
                mathService.money(
                        row.netValueAmount()
                ),
                mathService.decimal(
                        row.roiPct()
                ),
                row.paybackMonths() == null
                        ? null
                        : mathService.decimal(
                                row.paybackMonths()
                        ),
                mathService.money(
                        row.valueAtRiskAmount()
                ),
                row.valueHealth()
        );
    }

    private boolean eligiblePersistencePlan(
            PersistencePlanResponse plan
    ) {
        if (!plan.assessed()) {
            return false;
        }

        if (
                plan.status()
                        != PersistencePlanStatus.SUSTAINED
                &&
                plan.status()
                        != PersistencePlanStatus.CLOSED
        ) {
            return false;
        }

        if (
                plan.persistenceHealth()
                        == PersistenceHealth.UNASSESSED
                ||
                plan.persistenceHealth()
                        == PersistenceHealth.DECAYING
                ||
                plan.persistenceHealth()
                        == PersistenceHealth.REGRESSED
        ) {
            return false;
        }

        if (
                plan.currentValidatedContributionPoints()
                        .compareTo(
                                BigDecimal.ZERO
                        )
                <= 0
        ) {
            return false;
        }

        return true;
    }

    private PersistencePlanResponse currentPersistencePlan(
            UUID currentUserId,
            UUID planId
    ) {
        return outcomePersistenceService
                .plan(
                        currentUserId,
                        planId
                )
                .plan();
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

    private StrategicValueRepository.CaseRow requireCase(
            UUID caseId
    ) {
        StrategicValueRepository.CaseRow valueCase =
                repository
                        .findCase(
                                caseId
                        );

        if (valueCase == null) {
            throw new ResourceNotFoundException(
                    "Strategic value case not found: "
                            + caseId
            );
        }

        return valueCase;
    }

    private AppUserEntity requireValueUser(
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
                    "Requester accounts cannot own strategic value governance."
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
                "VALUE-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextCaseSequence()
        );
    }

    private String nextReviewNumber() {
        return String.format(
                "VALRVW-%d-%05d",
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
                    "Your ProcureIQ role cannot access strategic value governance."
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
                    "Your ProcureIQ role cannot manage strategic value governance."
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
                    "Only administrators and procurement managers can independently verify strategic value cases."
            );
        }
    }
}
