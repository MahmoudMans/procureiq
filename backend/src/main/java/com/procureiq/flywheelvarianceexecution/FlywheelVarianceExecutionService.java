package com.procureiq.flywheelvarianceexecution;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.common.money.CurrencyTotals;
import com.procureiq.flywheelvariance.FlywheelVarianceDecision;
import com.procureiq.flywheelvariance.FlywheelVarianceItemResponse;
import com.procureiq.flywheelvariance.FlywheelVariancePlanDetailResponse;
import com.procureiq.flywheelvariance.FlywheelVariancePlanResponse;
import com.procureiq.flywheelvariance.FlywheelVariancePlanStatus;
import com.procureiq.flywheelvariance.FlywheelVarianceService;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(
        isolation = Isolation.READ_COMMITTED
)
public class FlywheelVarianceExecutionService {

    private final FlywheelVarianceExecutionRepository repository;

    private final FlywheelVarianceExecutionPolicyService policy;

    private final FlywheelVarianceService varianceService;

    private final AppUserRepository appUserRepository;

    public FlywheelVarianceExecutionService(
            FlywheelVarianceExecutionRepository repository,
            FlywheelVarianceExecutionPolicyService policy,
            FlywheelVarianceService varianceService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.policy =
                policy;

        this.varianceService =
                varianceService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public FlywheelVarianceExecutionDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        List<FlywheelVarianceExecutionSourceResponse> plans =
                eligiblePlans(
                        currentUserId
                );

        List<FlywheelVarianceExecutionCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .map(
                                this::caseResponse
                        )
                        .toList();

        return new FlywheelVarianceExecutionDashboardResponse(
                summary(
                        plans.size(),
                        cases
                ),

                repository.users(),

                plans,

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

    public FlywheelVarianceExecutionCaseDetailResponse createCase(
            UUID currentUserId,
            FlywheelVarianceExecutionCaseInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        repository.lockVariancePlan(
                input.variancePlanId()
        );

        FlywheelVariancePlanDetailResponse plan =
                requireApprovedPlan(
                        currentUserId,
                        input.variancePlanId()
                );

        if (
                repository.hasCaseForVariancePlan(
                        input.variancePlanId()
                )
        ) {
            throw new IllegalArgumentException(
                    "This Step 73 variance plan already has a treatment-execution case."
            );
        }

        AppUserEntity owner =
                requireExecutionOwner(
                        input.executionOwnerUserId()
                );

        FlywheelVarianceExecutionSourceResponse source =
                sourceResponse(
                        plan.plan()
                );

        UUID caseId =
                UUID.randomUUID();

        repository.createCase(
                caseId,
                nextCaseNumber(),
                input,
                source,
                owner.getFullName(),
                currentUserId
        );

        return executionCase(
                currentUserId,
                caseId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelVarianceExecutionCaseDetailResponse executionCase(
            UUID currentUserId,
            UUID caseId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceExecutionRepository.CaseRow executionCase =
                requireCase(
                        caseId
                );

        FlywheelVariancePlanDetailResponse plan =
                varianceService.plan(
                        currentUserId,
                        executionCase.variancePlanId()
                );

        List<FlywheelVarianceExecutionRepository.ItemRow> currentItems =
                repository.items(
                        caseId
                );

        List<FlywheelVarianceExecutionCandidateResponse> candidates =
                plan
                        .items()
                        .stream()
                        .filter(
                                source ->
                                        currentItems
                                                .stream()
                                                .noneMatch(
                                                        existing ->
                                                                existing
                                                                        .varianceItemId()
                                                                        .equals(
                                                                                source.id()
                                                                        )
                                                )
                        )
                        .map(
                                this::candidateResponse
                        )
                        .toList();

        return new FlywheelVarianceExecutionCaseDetailResponse(
                caseResponse(
                        executionCase
                ),

                sourceResponse(
                        plan.plan()
                ),

                repository.users(),

                candidates,

                currentItems
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList(),

                repository
                        .snapshotsForCase(
                                caseId
                        )
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public FlywheelVarianceExecutionCaseDetailResponse addItem(
            UUID currentUserId,
            UUID caseId,
            FlywheelVarianceExecutionItemInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceExecutionRepository.CaseRow executionCase =
                requireLockedCase(
                        caseId
                );

        if (
                executionCase.status()
                        != FlywheelVarianceExecutionCaseStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Treatment execution evidence can be added only while the case is DRAFT."
            );
        }

        FlywheelVariancePlanDetailResponse plan =
                requireApprovedPlan(
                        currentUserId,
                        executionCase.variancePlanId()
                );

        validateSourceAuthority(
                executionCase,
                plan
        );

        FlywheelVarianceItemResponse source =
                plan
                        .items()
                        .stream()
                        .filter(
                                item ->
                                        item.id()
                                                .equals(
                                                        input.varianceItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Variance item does not belong to the Step 73 source plan."
                                        )
                        );

        if (
                repository
                        .items(
                                caseId
                        )
                        .stream()
                        .anyMatch(
                                item ->
                                        item.varianceItemId()
                                                .equals(
                                                        source.id()
                                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Execution evidence already exists for this Step 73 variance item."
            );
        }

        String reference =
                policy.optionalReference(
                        input.evidenceReference()
                );

        String note =
                policy.requiredText(
                        input.evidenceNote(),
                        5000,
                        "Execution evidence note"
                );

        FlywheelVarianceExecutionValidationResult validation =
                policy.validate(
                        source.decision(),
                        source.sourceVarianceAmount(),
                        input.executedAmount(),
                        input.outcome(),
                        reference
                );

        repository.createItem(
                UUID.randomUUID(),
                caseId,
                candidateResponse(
                        source
                ),
                validation,
                input,
                reference,
                note,
                currentUserId
        );

        return executionCase(
                currentUserId,
                caseId
        );
    }

    public FlywheelVarianceExecutionCaseDetailResponse submitForReview(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceExecutionRepository.CaseRow executionCase =
                requireLockedCase(
                        caseId
                );

        if (
                executionCase.status()
                        != FlywheelVarianceExecutionCaseStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only a DRAFT treatment-execution case can enter review."
            );
        }

        FlywheelVariancePlanDetailResponse plan =
                requireApprovedPlan(
                        currentUserId,
                        executionCase.variancePlanId()
                );

        validateSourceAuthority(
                executionCase,
                plan
        );

        List<FlywheelVarianceExecutionRepository.ItemRow> executionItems =
                repository.items(
                        caseId
                );

        if (
                executionItems.size()
                        != plan.items().size()
        ) {
            throw new IllegalArgumentException(
                    "Every Step 73 variance decision requires execution evidence before review."
            );
        }

        for (
                FlywheelVarianceExecutionRepository.ItemRow executionItem
                : executionItems
        ) {
            validateItemAuthority(
                    plan.items(),
                    executionItem
            );
        }

        BigDecimal capturedAuthority =
                executionItems
                        .stream()
                        .map(
                                FlywheelVarianceExecutionRepository.ItemRow::
                                        sourceVarianceAmount
                        )
                        .map(
                                policy::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        if (
                capturedAuthority.compareTo(
                        policy.money(
                                executionCase.sourceVarianceAmount()
                        )
                ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Captured execution evidence does not cover all Step 73 variance authority."
            );
        }

        int updated =
                repository.submitForReview(
                        caseId,
                        currentUserId
                );

        if (
                updated != 1
        ) {
            throw new IllegalArgumentException(
                    "Treatment-execution state changed before review submission."
            );
        }

        return executionCase(
                currentUserId,
                caseId
        );
    }

    public FlywheelVarianceExecutionCaseDetailResponse verify(
            UUID currentUserId,
            UUID caseId,
            FlywheelVarianceExecutionNoteInput input
    ) {
        assertVerifyRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceExecutionRepository.CaseRow executionCase =
                requireLockedCase(
                        caseId
                );

        if (
                executionCase.status()
                        != FlywheelVarianceExecutionCaseStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only an IN_REVIEW treatment-execution case can be verified."
            );
        }

        FlywheelVariancePlanDetailResponse plan =
                requireApprovedPlan(
                        currentUserId,
                        executionCase.variancePlanId()
                );

        validateSourceAuthority(
                executionCase,
                plan
        );

        List<FlywheelVarianceExecutionRepository.ItemRow> items =
                repository.items(
                        caseId
                );

        if (
                items.size()
                        != plan.items().size()
        ) {
            throw new IllegalArgumentException(
                    "Treatment verification requires evidence for every Step 73 variance decision."
            );
        }

        String note =
                policy.requiredText(
                        input.note(),
                        5000,
                        "Verification note"
                );

        int updated =
                repository.verify(
                        caseId,
                        note,
                        currentUserId
                );

        if (
                updated != 1
        ) {
            throw new IllegalArgumentException(
                    "Treatment-execution state changed before verification."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                caseId
        );

        return executionCase(
                currentUserId,
                caseId
        );
    }

    public FlywheelVarianceExecutionCaseDetailResponse close(
            UUID currentUserId,
            UUID caseId,
            FlywheelVarianceExecutionNoteInput input
    ) {
        assertVerifyRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceExecutionRepository.CaseRow executionCase =
                requireLockedCase(
                        caseId
                );

        if (
                executionCase.status()
                        != FlywheelVarianceExecutionCaseStatus.VERIFIED
        ) {
            throw new IllegalArgumentException(
                    "Only a VERIFIED treatment-execution case can be closed."
            );
        }

        String note =
                policy.requiredText(
                        input.note(),
                        5000,
                        "Closure note"
                );

        int updated =
                repository.close(
                        caseId,
                        note,
                        currentUserId
                );

        if (
                updated != 1
        ) {
            throw new IllegalArgumentException(
                    "Treatment-execution state changed before closure."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                caseId
        );

        return executionCase(
                currentUserId,
                caseId
        );
    }

    public FlywheelVarianceExecutionSnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        requireCase(
                caseId
        );

        return captureSnapshotInternal(
                currentUserId,
                caseId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelVarianceExecutionSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceExecutionRepository.SnapshotRow snapshot =
                repository.findSnapshot(
                        snapshotId
                );

        if (
                snapshot == null
        ) {
            throw new ResourceNotFoundException(
                    "Variance treatment execution snapshot not found: "
                            + snapshotId
            );
        }

        return new FlywheelVarianceExecutionSnapshotDetailResponse(
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

    private FlywheelVarianceExecutionSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId,
            UUID caseId
    ) {
        FlywheelVarianceExecutionRepository.CaseRow executionCase =
                requireLockedCase(
                        caseId
                );

        List<FlywheelVarianceExecutionItemResponse> items =
                repository
                        .items(
                                caseId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        FlywheelVarianceExecutionCaseResponse response =
                caseResponse(
                        executionCase
                );

        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                response,
                currentUserId
        );

        for (
                FlywheelVarianceExecutionItemResponse item
                : items
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    item
            );
        }

        if (
                repository.sealSnapshot(
                        snapshotId
                ) != 1
        ) {
            throw new IllegalStateException(
                    "Treatment-execution snapshot could not be sealed."
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<FlywheelVarianceExecutionSourceResponse> eligiblePlans(
            UUID currentUserId
    ) {
        return varianceService
                .dashboard(
                        currentUserId
                )
                .plans()
                .stream()
                .filter(
                        plan ->
                                plan.status()
                                        == FlywheelVariancePlanStatus.APPROVED
                                ||
                                plan.status()
                                        == FlywheelVariancePlanStatus.CLOSED
                )
                .filter(
                        plan ->
                                plan.sourceVarianceAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        ) > 0
                )
                .filter(
                        plan ->
                                !repository.hasCaseForVariancePlan(
                                        plan.id()
                                )
                )
                .map(
                        this::sourceResponse
                )
                .toList();
    }

    private FlywheelVariancePlanDetailResponse requireApprovedPlan(
            UUID currentUserId,
            UUID planId
    ) {
        FlywheelVariancePlanDetailResponse detail =
                varianceService.plan(
                        currentUserId,
                        planId
                );

        FlywheelVariancePlanStatus status =
                detail
                        .plan()
                        .status();

        if (
                status
                        != FlywheelVariancePlanStatus.APPROVED
                &&
                status
                        != FlywheelVariancePlanStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Step 74 requires an APPROVED or CLOSED Step 73 variance plan."
            );
        }

        if (
                detail
                        .plan()
                        .sourceVarianceAmount()
                        .compareTo(
                                BigDecimal.ZERO
                        ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "Step 73 plan contains no positive variance authority."
            );
        }

        return detail;
    }

    private FlywheelVarianceExecutionSourceResponse sourceResponse(
            FlywheelVariancePlanResponse plan
    ) {
        return new FlywheelVarianceExecutionSourceResponse(
                plan.id(),
                plan.planNumber(),

                plan.settlementCaseId(),
                plan.reconciliationNumber(),

                plan.releaseBatchId(),
                plan.releaseNumber(),

                plan.allocationMandateId(),
                plan.allocationMandateNumber(),

                plan.strategyPortfolioId(),
                plan.strategyPortfolioNumber(),

                plan.title(),

                plan.currency(),
                plan.fiscalYear(),

                policy.money(
                        plan.sourceVarianceAmount()
                ),

                policy.money(
                        plan.recoverAmount()
                ),

                policy.money(
                        plan.writeOffAmount()
                ),

                policy.money(
                        plan.investigationAmount()
                ),

                plan.itemCount(),

                plan.planOwnerName(),
                plan.resolutionObjective(),

                plan.status()
        );
    }

    private FlywheelVarianceExecutionCandidateResponse candidateResponse(
            FlywheelVarianceItemResponse item
    ) {
        return new FlywheelVarianceExecutionCandidateResponse(
                item.id(),

                item.settlementItemId(),

                item.releaseItemId(),
                item.allocationItemId(),

                item.flywheelLineageId(),
                item.lineageNumber(),

                item.rootTargetInitiativeTitle(),

                policy.money(
                        item.sourceVarianceAmount()
                ),

                item.decision(),

                item.decisionRationale(),

                item.targetDate()
        );
    }

    private void validateSourceAuthority(
            FlywheelVarianceExecutionRepository.CaseRow executionCase,
            FlywheelVariancePlanDetailResponse sourceDetail
    ) {
        FlywheelVariancePlanResponse source =
                sourceDetail.plan();

        if (
                !source
                        .planNumber()
                        .equals(
                                executionCase.variancePlanNumber()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 73 plan identity changed after execution-case creation."
            );
        }

        if (
                !source
                        .settlementCaseId()
                        .equals(
                                executionCase.settlementCaseId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 73 settlement authority changed after execution-case creation."
            );
        }

        if (
                !source
                        .releaseBatchId()
                        .equals(
                                executionCase.releaseBatchId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 73 release authority changed after execution-case creation."
            );
        }

        if (
                !source
                        .currency()
                        .equalsIgnoreCase(
                                executionCase.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 73 variance-plan currency changed after execution-case creation."
            );
        }

        if (
                policy
                        .money(
                                source.sourceVarianceAmount()
                        )
                        .compareTo(
                                policy.money(
                                        executionCase.sourceVarianceAmount()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 73 source variance changed after execution-case creation."
            );
        }

        if (
                policy
                        .money(
                                source.recoverAmount()
                        )
                        .compareTo(
                                policy.money(
                                        executionCase.sourceRecoverAmount()
                                )
                        ) != 0

                ||

                policy
                        .money(
                                source.writeOffAmount()
                        )
                        .compareTo(
                                policy.money(
                                        executionCase.sourceWriteOffAmount()
                                )
                        ) != 0

                ||

                policy
                        .money(
                                source.investigationAmount()
                        )
                        .compareTo(
                                policy.money(
                                        executionCase.sourceInvestigationAmount()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 73 treatment mix changed after execution-case creation."
            );
        }
    }

    private void validateItemAuthority(
            List<FlywheelVarianceItemResponse> sourceItems,
            FlywheelVarianceExecutionRepository.ItemRow executionItem
    ) {
        FlywheelVarianceItemResponse source =
                sourceItems
                        .stream()
                        .filter(
                                item ->
                                        item.id()
                                                .equals(
                                                        executionItem.varianceItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Treatment execution references a Step 73 item that no longer exists."
                                        )
                        );

        if (
                !source
                        .settlementItemId()
                        .equals(
                                executionItem.settlementItemId()
                        )

                ||

                !source
                        .releaseItemId()
                        .equals(
                                executionItem.releaseItemId()
                        )

                ||

                !source
                        .allocationItemId()
                        .equals(
                                executionItem.allocationItemId()
                        )

                ||

                !source
                        .flywheelLineageId()
                        .equals(
                                executionItem.flywheelLineageId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Treatment execution lineage authority changed."
            );
        }

        if (
                policy
                        .money(
                                source.sourceVarianceAmount()
                        )
                        .compareTo(
                                policy.money(
                                        executionItem.sourceVarianceAmount()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Treatment execution source variance changed."
            );
        }

        if (
                source.decision()
                        != executionItem.sourceDecision()
        ) {
            throw new IllegalArgumentException(
                    "Step 73 treatment decision changed after execution evidence capture."
            );
        }
    }

    private FlywheelVarianceExecutionMetricResult metric(
            FlywheelVarianceExecutionRepository.CaseRow executionCase,
            List<FlywheelVarianceExecutionRepository.ItemRow> items
    ) {
        return policy.metrics(
                executionCase.sourceVarianceAmount(),

                items
                        .stream()
                        .map(
                                item ->
                                        new FlywheelVarianceExecutionMetricInput(
                                                item.sourceDecision(),
                                                item.sourceVarianceAmount(),
                                                item.executedAmount(),
                                                item.outcome()
                                        )
                        )
                        .toList()
        );
    }

    private FlywheelVarianceExecutionCaseResponse caseResponse(
            FlywheelVarianceExecutionRepository.CaseRow row
    ) {
        List<FlywheelVarianceExecutionRepository.ItemRow> items =
                repository.items(
                        row.id()
                );

        FlywheelVarianceExecutionMetricResult metric =
                metric(
                        row,
                        items
                );

        return new FlywheelVarianceExecutionCaseResponse(
                row.id(),
                row.executionNumber(),

                row.variancePlanId(),
                row.variancePlanNumber(),

                row.settlementCaseId(),
                row.reconciliationNumber(),

                row.releaseBatchId(),
                row.releaseNumber(),

                row.allocationMandateId(),
                row.allocationMandateNumber(),

                row.strategyPortfolioId(),
                row.strategyPortfolioNumber(),

                row.title(),

                row.currency(),
                row.fiscalYear(),

                policy.money(
                        row.sourceVarianceAmount()
                ),

                policy.money(
                        row.sourceRecoverAmount()
                ),

                policy.money(
                        row.sourceWriteOffAmount()
                ),

                policy.money(
                        row.sourceInvestigationAmount()
                ),

                metric.capturedVarianceAmount(),

                metric.executedFinancialAmount(),

                metric.recoveredAmount(),
                metric.writtenOffAmount(),
                metric.completedInvestigationAmount(),

                metric.openExposureAmount(),
                metric.completionPct(),

                items.size(),

                countOutcome(
                        items,
                        FlywheelVarianceExecutionOutcome.COMPLETED
                ),

                countOutcome(
                        items,
                        FlywheelVarianceExecutionOutcome.PARTIAL
                ),

                countOutcome(
                        items,
                        FlywheelVarianceExecutionOutcome.UNRESOLVED
                ),

                row.executionOwnerUserId(),
                row.executionOwnerName(),

                row.executionObjective(),

                row.status(),

                row.submittedByName(),
                row.submittedAt(),

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

    private FlywheelVarianceExecutionItemResponse itemResponse(
            FlywheelVarianceExecutionRepository.ItemRow row
    ) {
        FlywheelVarianceExecutionValidationResult validation =
                policy.validate(
                        row.sourceDecision(),
                        row.sourceVarianceAmount(),
                        row.executedAmount(),
                        row.outcome(),
                        row.evidenceReference()
                );

        return new FlywheelVarianceExecutionItemResponse(
                row.id(),
                row.executionCaseId(),

                row.varianceItemId(),

                row.settlementItemId(),

                row.releaseItemId(),
                row.allocationItemId(),

                row.flywheelLineageId(),
                row.lineageNumber(),

                row.rootTargetInitiativeTitle(),

                validation.sourceVarianceAmount(),

                row.sourceDecision(),

                validation.executedAmount(),
                validation.openExposureAmount(),

                row.outcome(),

                row.evidenceReference(),
                row.evidenceDate(),
                row.evidenceNote(),

                row.addedByName(),
                row.addedAt()
        );
    }

    private FlywheelVarianceExecutionSummaryResponse summary(
            int eligiblePlanCount,
            List<FlywheelVarianceExecutionCaseResponse> cases
    ) {
        List<FlywheelVarianceExecutionCaseResponse> finalized =
                cases
                        .stream()
                        .filter(
                                executionCase ->
                                        executionCase.status()
                                                == FlywheelVarianceExecutionCaseStatus.VERIFIED
                                        ||
                                        executionCase.status()
                                                == FlywheelVarianceExecutionCaseStatus.CLOSED
                        )
                        .toList();

        return new FlywheelVarianceExecutionSummaryResponse(
                eligiblePlanCount,

                cases.size(),

                countStatus(
                        cases,
                        FlywheelVarianceExecutionCaseStatus.DRAFT
                ),

                countStatus(
                        cases,
                        FlywheelVarianceExecutionCaseStatus.IN_REVIEW
                ),

                countStatus(
                        cases,
                        FlywheelVarianceExecutionCaseStatus.VERIFIED
                ),

                countStatus(
                        cases,
                        FlywheelVarianceExecutionCaseStatus.CLOSED
                ),

                CurrencyTotals.sum(
                        finalized,
                        FlywheelVarianceExecutionCaseResponse::currency,
                        FlywheelVarianceExecutionCaseResponse::recoveredAmount
                ),

                CurrencyTotals.sum(
                        finalized,
                        FlywheelVarianceExecutionCaseResponse::currency,
                        FlywheelVarianceExecutionCaseResponse::writtenOffAmount
                ),

                CurrencyTotals.sum(
                        finalized,
                        FlywheelVarianceExecutionCaseResponse::currency,
                        FlywheelVarianceExecutionCaseResponse::completedInvestigationAmount
                ),

                CurrencyTotals.sum(
                        finalized,
                        FlywheelVarianceExecutionCaseResponse::currency,
                        FlywheelVarianceExecutionCaseResponse::openExposureAmount
                ),
                CurrencyTotals.sum(
                        finalized,
                        FlywheelVarianceExecutionCaseResponse::currency,
                        entry -> entry.exposure().financialResidualAmount()
                )
        );
    }

    private int countStatus(
            List<FlywheelVarianceExecutionCaseResponse> cases,
            FlywheelVarianceExecutionCaseStatus status
    ) {
        return (int)
                cases
                        .stream()
                        .filter(
                                executionCase ->
                                        executionCase.status()
                                                == status
                        )
                        .count();
    }

    private int countOutcome(
            List<FlywheelVarianceExecutionRepository.ItemRow> items,
            FlywheelVarianceExecutionOutcome outcome
    ) {
        return (int)
                items
                        .stream()
                        .filter(
                                item ->
                                        item.outcome()
                                                == outcome
                        )
                        .count();
    }

    private FlywheelVarianceExecutionSnapshotSummaryResponse snapshotSummary(
            FlywheelVarianceExecutionRepository.SnapshotRow row
    ) {
        return new FlywheelVarianceExecutionSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),

                row.executionCaseId(),
                row.executionNumber(),

                row.variancePlanId(),
                row.variancePlanNumber(),

                row.caseStatus(),

                row.currency(),
                row.fiscalYear(),

                policy.money(
                        row.sourceVarianceAmount()
                ),

                policy.money(
                        row.capturedVarianceAmount()
                ),

                policy.money(
                        row.executedFinancialAmount()
                ),

                policy.money(
                        row.recoveredAmount()
                ),

                policy.money(
                        row.writtenOffAmount()
                ),

                policy.money(
                        row.completedInvestigationAmount()
                ),

                policy.money(
                        row.openExposureAmount()
                ),

                row.completionPct(),

                row.itemCount(),
                row.completedCount(),
                row.partialCount(),
                row.unresolvedCount(),

                row.capturedByName(),
                row.capturedAt()
        );
    }

    private FlywheelVarianceExecutionSnapshotItemResponse snapshotItemResponse(
            FlywheelVarianceExecutionRepository.SnapshotItemRow row
    ) {
        return new FlywheelVarianceExecutionSnapshotItemResponse(
                row.varianceItemId(),

                row.flywheelLineageId(),
                row.lineageNumber(),

                row.rootTargetInitiativeTitle(),

                policy.money(
                        row.sourceVarianceAmount()
                ),

                row.sourceDecision(),

                policy.money(
                        row.executedAmount()
                ),

                row.outcome(),

                row.evidenceReference(),
                row.evidenceDate(),
                row.evidenceNote()
        );
    }

    private FlywheelVarianceExecutionRepository.CaseRow requireLockedCase(
            UUID caseId
    ) {
        FlywheelVarianceExecutionRepository.CaseRow observed =
                requireCase(
                        caseId
                );

        repository.lockVariancePlan(
                observed.variancePlanId()
        );

        repository.lockCase(
                caseId
        );

        FlywheelVarianceExecutionRepository.CaseRow current =
                requireCase(
                        caseId
                );

        if (
                !current
                        .variancePlanId()
                        .equals(
                                observed.variancePlanId()
                        )
        ) {
            throw new IllegalStateException(
                    "Treatment-execution source plan changed while acquiring the governance lock."
            );
        }

        return current;
    }

    private FlywheelVarianceExecutionRepository.CaseRow requireCase(
            UUID caseId
    ) {
        FlywheelVarianceExecutionRepository.CaseRow executionCase =
                repository.findCase(
                        caseId
                );

        if (
                executionCase == null
        ) {
            throw new ResourceNotFoundException(
                    "Variance treatment execution case not found: "
                            + caseId
            );
        }

        return executionCase;
    }

    private AppUserEntity requireExecutionOwner(
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
                    "Requester accounts cannot own variance treatment execution."
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

        if (
                !user.isActive()
        ) {
            throw new IllegalArgumentException(
                    "ProcureIQ account is inactive."
            );
        }

        return user;
    }

    private String nextCaseNumber() {
        return String.format(
                "FWEXEC-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                ).getValue(),
                repository.nextCaseSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "FWEXECSNAP-%d-%05d",
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
                role
                        != ProcurementRole.ADMIN
                &&
                role
                        != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role
                        != ProcurementRole.BUYER
                &&
                role
                        != ProcurementRole.APPROVER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot access variance treatment execution."
            );
        }
    }

    private void assertWriteRole(
            ProcurementRole role
    ) {
        if (
                role
                        != ProcurementRole.ADMIN
                &&
                role
                        != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role
                        != ProcurementRole.BUYER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot record variance treatment execution evidence."
            );
        }
    }

    private void assertVerifyRole(
            ProcurementRole role
    ) {
        if (
                role
                        != ProcurementRole.ADMIN
                &&
                role
                        != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can verify variance treatment execution."
            );
        }
    }
}
