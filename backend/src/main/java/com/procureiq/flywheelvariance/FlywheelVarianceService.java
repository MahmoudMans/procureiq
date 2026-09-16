package com.procureiq.flywheelvariance;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.common.money.CurrencyTotals;
import com.procureiq.flywheelsettlement.FlywheelSettlementCaseDetailResponse;
import com.procureiq.flywheelsettlement.FlywheelSettlementCaseResponse;
import com.procureiq.flywheelsettlement.FlywheelSettlementCaseStatus;
import com.procureiq.flywheelsettlement.FlywheelSettlementItemResponse;
import com.procureiq.flywheelsettlement.FlywheelSettlementItemStatus;
import com.procureiq.flywheelsettlement.FlywheelSettlementService;
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
public class FlywheelVarianceService {

    private final FlywheelVarianceRepository repository;

    private final FlywheelVariancePolicyService policy;

    private final FlywheelSettlementService settlementService;

    private final AppUserRepository appUserRepository;

    public FlywheelVarianceService(
            FlywheelVarianceRepository repository,
            FlywheelVariancePolicyService policy,
            FlywheelSettlementService settlementService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.policy =
                policy;

        this.settlementService =
                settlementService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public FlywheelVarianceDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        List<FlywheelVarianceSourceResponse> settlements =
                eligibleSettlements(
                        currentUserId
                );

        List<FlywheelVariancePlanResponse> plans =
                repository
                        .plans()
                        .stream()
                        .map(
                                this::planResponse
                        )
                        .toList();

        return new FlywheelVarianceDashboardResponse(
                summary(
                        settlements.size(),
                        plans
                ),

                repository.users(),

                settlements,

                plans,

                repository
                        .snapshots()
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public FlywheelVariancePlanDetailResponse createPlan(
            UUID currentUserId,
            FlywheelVariancePlanInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        repository.lockSettlementCase(
                input.settlementCaseId()
        );

        FlywheelSettlementCaseDetailResponse settlement =
                requireFinalizedSettlement(
                        currentUserId,
                        input.settlementCaseId()
                );

        if (
                repository.hasPlanForSettlementCase(
                        input.settlementCaseId()
                )
        ) {
            throw new IllegalArgumentException(
                    "This settlement reconciliation case already has a variance-resolution plan."
            );
        }

        AppUserEntity owner =
                requirePlanOwner(
                        input.planOwnerUserId()
                );

        FlywheelVarianceSourceResponse source =
                sourceResponse(
                        settlement.settlementCase()
                );

        UUID planId =
                UUID.randomUUID();

        repository.createPlan(
                planId,
                nextPlanNumber(),
                input,
                source,
                owner.getFullName(),
                currentUserId
        );

        return plan(
                currentUserId,
                planId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelVariancePlanDetailResponse plan(
            UUID currentUserId,
            UUID planId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceRepository.PlanRow plan =
                requirePlan(
                        planId
                );

        FlywheelSettlementCaseDetailResponse settlement =
                settlementService.settlementCase(
                        currentUserId,
                        plan.settlementCaseId()
                );

        List<FlywheelVarianceRepository.ItemRow> currentItems =
                repository.items(
                        planId
                );

        List<FlywheelVarianceCandidateResponse> candidates =
                settlement
                        .items()
                        .stream()
                        .filter(
                                item ->
                                        item.varianceAmount()
                                                .compareTo(
                                                        BigDecimal.ZERO
                                                ) > 0
                        )
                        .filter(
                                item ->
                                        item.reconciliationStatus()
                                                == FlywheelSettlementItemStatus.PARTIAL
                                        ||
                                        item.reconciliationStatus()
                                                == FlywheelSettlementItemStatus.UNRESOLVED
                        )
                        .filter(
                                item ->
                                        currentItems
                                                .stream()
                                                .noneMatch(
                                                        existing ->
                                                                existing
                                                                        .settlementItemId()
                                                                        .equals(
                                                                                item.id()
                                                                        )
                                                )
                        )
                        .map(
                                this::candidateResponse
                        )
                        .toList();

        return new FlywheelVariancePlanDetailResponse(
                planResponse(
                        plan
                ),

                sourceResponse(
                        settlement.settlementCase()
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
                        .snapshotsForPlan(
                                planId
                        )
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public FlywheelVariancePlanDetailResponse addItem(
            UUID currentUserId,
            UUID planId,
            FlywheelVarianceItemInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceRepository.PlanRow plan =
                requireLockedPlan(
                        planId
                );

        if (
                plan.status()
                        != FlywheelVariancePlanStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Variance decisions can be added only while the plan is DRAFT."
            );
        }

        FlywheelSettlementCaseDetailResponse settlement =
                requireFinalizedSettlement(
                        currentUserId,
                        plan.settlementCaseId()
                );

        validateSourceAuthority(
                plan,
                settlement
        );

        FlywheelSettlementItemResponse source =
                settlement
                        .items()
                        .stream()
                        .filter(
                                item ->
                                        item.id()
                                                .equals(
                                                        input.settlementItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Settlement item does not belong to the source reconciliation case."
                                        )
                        );

        if (
                source.varianceAmount()
                        .compareTo(
                                BigDecimal.ZERO
                        ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "Only positive settlement variance requires a treatment decision."
            );
        }

        if (
                source.reconciliationStatus()
                        != FlywheelSettlementItemStatus.PARTIAL
                &&
                source.reconciliationStatus()
                        != FlywheelSettlementItemStatus.UNRESOLVED
        ) {
            throw new IllegalArgumentException(
                    "Only PARTIAL or UNRESOLVED settlement items are eligible for variance governance."
            );
        }

        if (
                repository
                        .items(
                                planId
                        )
                        .stream()
                        .anyMatch(
                                item ->
                                        item.settlementItemId()
                                                .equals(
                                                        source.id()
                                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "This settlement variance already has a treatment decision."
            );
        }

        String rationale =
                policy.requiredText(
                        input.decisionRationale(),
                        5000,
                        "Decision rationale"
                );

        repository.createItem(
                UUID.randomUUID(),
                planId,
                candidateResponse(
                        source
                ),
                input,
                rationale,
                currentUserId
        );

        return plan(
                currentUserId,
                planId
        );
    }

    public FlywheelVariancePlanDetailResponse submitForReview(
            UUID currentUserId,
            UUID planId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceRepository.PlanRow plan =
                requireLockedPlan(
                        planId
                );

        if (
                plan.status()
                        != FlywheelVariancePlanStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only a DRAFT variance plan can enter review."
            );
        }

        FlywheelSettlementCaseDetailResponse settlement =
                requireFinalizedSettlement(
                        currentUserId,
                        plan.settlementCaseId()
                );

        validateSourceAuthority(
                plan,
                settlement
        );

        List<FlywheelSettlementItemResponse> sourceItems =
                eligibleSourceItems(
                        settlement
                );

        List<FlywheelVarianceRepository.ItemRow> planItems =
                repository.items(
                        planId
                );

        if (
                sourceItems.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "Source settlement contains no positive variance."
            );
        }

        if (
                sourceItems.size()
                        != planItems.size()
        ) {
            throw new IllegalArgumentException(
                    "Every positive settlement variance requires a treatment decision before review."
            );
        }

        for (
                FlywheelVarianceRepository.ItemRow planItem
                : planItems
        ) {
            validateItemAuthority(
                    sourceItems,
                    planItem
            );
        }

        FlywheelVarianceMetricResult metric =
                metric(
                        plan,
                        planItems
                );

        if (
                metric.coveragePct()
                        .compareTo(
                                new BigDecimal(
                                        "100.00"
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Variance governance must cover 100% of the source variance before review."
            );
        }

        int updated =
                repository.submitForReview(
                        planId,
                        currentUserId
                );

        if (
                updated != 1
        ) {
            throw new IllegalArgumentException(
                    "Variance-plan state changed before review submission."
            );
        }

        return plan(
                currentUserId,
                planId
        );
    }

    public FlywheelVariancePlanDetailResponse approve(
            UUID currentUserId,
            UUID planId,
            FlywheelVarianceNoteInput input
    ) {
        assertApproveRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceRepository.PlanRow plan =
                requireLockedPlan(
                        planId
                );

        if (
                plan.status()
                        != FlywheelVariancePlanStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only an IN_REVIEW variance plan can be approved."
            );
        }

        FlywheelSettlementCaseDetailResponse settlement =
                requireFinalizedSettlement(
                        currentUserId,
                        plan.settlementCaseId()
                );

        validateSourceAuthority(
                plan,
                settlement
        );

        List<FlywheelVarianceRepository.ItemRow> items =
                repository.items(
                        planId
                );

        FlywheelVarianceMetricResult metric =
                metric(
                        plan,
                        items
                );

        if (
                metric.coveragePct()
                        .compareTo(
                                new BigDecimal(
                                        "100.00"
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "A variance plan cannot be approved until 100% of the source variance is governed."
            );
        }

        String note =
                policy.requiredText(
                        input.note(),
                        5000,
                        "Approval note"
                );

        int updated =
                repository.approve(
                        planId,
                        note,
                        currentUserId
                );

        if (
                updated != 1
        ) {
            throw new IllegalArgumentException(
                    "Variance-plan state changed before approval."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                planId
        );

        return plan(
                currentUserId,
                planId
        );
    }

    public FlywheelVariancePlanDetailResponse close(
            UUID currentUserId,
            UUID planId,
            FlywheelVarianceNoteInput input
    ) {
        assertApproveRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceRepository.PlanRow plan =
                requireLockedPlan(
                        planId
                );

        if (
                plan.status()
                        != FlywheelVariancePlanStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Only an APPROVED variance plan can be closed."
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
                        planId,
                        note,
                        currentUserId
                );

        if (
                updated != 1
        ) {
            throw new IllegalArgumentException(
                    "Variance-plan state changed before closure."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                planId
        );

        return plan(
                currentUserId,
                planId
        );
    }

    public FlywheelVarianceSnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            UUID planId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        requirePlan(
                planId
        );

        return captureSnapshotInternal(
                currentUserId,
                planId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelVarianceSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelVarianceRepository.SnapshotRow snapshot =
                repository.findSnapshot(
                        snapshotId
                );

        if (
                snapshot == null
        ) {
            throw new ResourceNotFoundException(
                    "Flywheel variance snapshot not found: "
                            + snapshotId
            );
        }

        return new FlywheelVarianceSnapshotDetailResponse(
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

    private FlywheelVarianceSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId,
            UUID planId
    ) {
        FlywheelVarianceRepository.PlanRow plan =
                requireLockedPlan(
                        planId
                );

        List<FlywheelVarianceItemResponse> items =
                repository
                        .items(
                                planId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        FlywheelVariancePlanResponse response =
                planResponse(
                        plan
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
                FlywheelVarianceItemResponse item
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
                    "Variance snapshot could not be sealed."
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<FlywheelVarianceSourceResponse> eligibleSettlements(
            UUID currentUserId
    ) {
        return settlementService
                .dashboard(
                        currentUserId
                )
                .cases()
                .stream()
                .filter(
                        settlement ->
                                settlement.status()
                                        == FlywheelSettlementCaseStatus.RECONCILED
                                ||
                                settlement.status()
                                        == FlywheelSettlementCaseStatus.CLOSED
                )
                .filter(
                        settlement ->
                                settlement.varianceAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        ) > 0
                )
                .filter(
                        settlement ->
                                !repository.hasPlanForSettlementCase(
                                        settlement.id()
                                )
                )
                .map(
                        this::sourceResponse
                )
                .toList();
    }

    private FlywheelSettlementCaseDetailResponse requireFinalizedSettlement(
            UUID currentUserId,
            UUID settlementCaseId
    ) {
        FlywheelSettlementCaseDetailResponse detail =
                settlementService.settlementCase(
                        currentUserId,
                        settlementCaseId
                );

        FlywheelSettlementCaseStatus status =
                detail
                        .settlementCase()
                        .status();

        if (
                status
                        != FlywheelSettlementCaseStatus.RECONCILED
                &&
                status
                        != FlywheelSettlementCaseStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Step 73 requires a RECONCILED or CLOSED settlement reconciliation case."
            );
        }

        if (
                detail
                        .settlementCase()
                        .varianceAmount()
                        .compareTo(
                                BigDecimal.ZERO
                        ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "Settlement reconciliation contains no positive variance to govern."
            );
        }

        return detail;
    }

    private FlywheelVarianceSourceResponse sourceResponse(
            FlywheelSettlementCaseResponse settlement
    ) {
        return new FlywheelVarianceSourceResponse(
                settlement.id(),
                settlement.reconciliationNumber(),

                settlement.releaseBatchId(),
                settlement.releaseNumber(),

                settlement.allocationMandateId(),
                settlement.allocationMandateNumber(),

                settlement.strategyPortfolioId(),
                settlement.strategyPortfolioNumber(),

                settlement.title(),

                settlement.currency(),
                settlement.fiscalYear(),

                policy.money(
                        settlement.sourceReleasedAmount()
                ),

                policy.money(
                        settlement.settledAmount()
                ),

                policy.money(
                        settlement.varianceAmount()
                ),

                settlement.partialCount(),
                settlement.unresolvedCount(),

                settlement.reconciliationOwnerName(),
                settlement.reconciliationRationale(),

                settlement.status()
        );
    }

    private FlywheelVarianceCandidateResponse candidateResponse(
            FlywheelSettlementItemResponse item
    ) {
        return new FlywheelVarianceCandidateResponse(
                item.id(),

                item.releaseItemId(),
                item.allocationItemId(),

                item.flywheelLineageId(),
                item.lineageNumber(),

                item.rootTargetInitiativeTitle(),

                policy.money(
                        item.sourceReleasedAmount()
                ),

                policy.money(
                        item.settledAmount()
                ),

                policy.money(
                        item.varianceAmount()
                ),

                item.reconciliationStatus()
        );
    }

    private List<FlywheelSettlementItemResponse> eligibleSourceItems(
            FlywheelSettlementCaseDetailResponse settlement
    ) {
        return settlement
                .items()
                .stream()
                .filter(
                        item ->
                                item.varianceAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        ) > 0
                )
                .filter(
                        item ->
                                item.reconciliationStatus()
                                        == FlywheelSettlementItemStatus.PARTIAL
                                ||
                                item.reconciliationStatus()
                                        == FlywheelSettlementItemStatus.UNRESOLVED
                )
                .toList();
    }

    private void validateSourceAuthority(
            FlywheelVarianceRepository.PlanRow plan,
            FlywheelSettlementCaseDetailResponse settlement
    ) {
        FlywheelSettlementCaseResponse source =
                settlement.settlementCase();

        if (
                !source
                        .reconciliationNumber()
                        .equals(
                                plan.reconciliationNumber()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Settlement reconciliation identity changed after variance-plan creation."
            );
        }

        if (
                !source
                        .releaseBatchId()
                        .equals(
                                plan.releaseBatchId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Release authority changed after variance-plan creation."
            );
        }

        if (
                !source
                        .allocationMandateId()
                        .equals(
                                plan.allocationMandateId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Allocation authority changed after variance-plan creation."
            );
        }

        if (
                !source
                        .strategyPortfolioId()
                        .equals(
                                plan.strategyPortfolioId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Strategy authority changed after variance-plan creation."
            );
        }

        if (
                !source
                        .currency()
                        .equalsIgnoreCase(
                                plan.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Settlement currency changed after variance-plan creation."
            );
        }

        BigDecimal positiveVariance =
                eligibleSourceItems(
                        settlement
                )
                        .stream()
                        .map(
                                FlywheelSettlementItemResponse::
                                        varianceAmount
                        )
                        .map(
                                policy::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        if (
                positiveVariance.compareTo(
                        policy.money(
                                plan.sourceVarianceAmount()
                        )
                ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Settlement variance authority changed after variance-plan creation."
            );
        }
    }

    private void validateItemAuthority(
            List<FlywheelSettlementItemResponse> sourceItems,
            FlywheelVarianceRepository.ItemRow planItem
    ) {
        FlywheelSettlementItemResponse source =
                sourceItems
                        .stream()
                        .filter(
                                item ->
                                        item.id()
                                                .equals(
                                                        planItem.settlementItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Variance treatment refers to a settlement item that is no longer eligible."
                                        )
                        );

        if (
                !source
                        .releaseItemId()
                        .equals(
                                planItem.releaseItemId()
                        )
                ||
                !source
                        .allocationItemId()
                        .equals(
                                planItem.allocationItemId()
                        )
                ||
                !source
                        .flywheelLineageId()
                        .equals(
                                planItem.flywheelLineageId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Variance treatment lineage authority changed."
            );
        }

        if (
                policy
                        .money(
                                source.varianceAmount()
                        )
                        .compareTo(
                                policy.money(
                                        planItem.sourceVarianceAmount()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Variance treatment amount no longer matches settlement authority."
            );
        }

        if (
                source.reconciliationStatus()
                        != planItem.sourceReconciliationStatus()
        ) {
            throw new IllegalArgumentException(
                    "Settlement reconciliation classification changed after variance capture."
            );
        }
    }

    private FlywheelVarianceMetricResult metric(
            FlywheelVarianceRepository.PlanRow plan,
            List<FlywheelVarianceRepository.ItemRow> items
    ) {
        return policy.metrics(
                plan.sourceVarianceAmount(),

                items
                        .stream()
                        .map(
                                item ->
                                        new FlywheelVarianceMetricInput(
                                                item.decision(),
                                                item.sourceVarianceAmount()
                                        )
                        )
                        .toList()
        );
    }

    private FlywheelVariancePlanResponse planResponse(
            FlywheelVarianceRepository.PlanRow row
    ) {
        List<FlywheelVarianceRepository.ItemRow> items =
                repository.items(
                        row.id()
                );

        FlywheelVarianceMetricResult metric =
                metric(
                        row,
                        items
                );

        return new FlywheelVariancePlanResponse(
                row.id(),
                row.planNumber(),

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

                metric.governedAmount(),
                metric.recoverAmount(),
                metric.writeOffAmount(),
                metric.investigationAmount(),
                metric.coveragePct(),

                items.size(),

                countDecision(
                        items,
                        FlywheelVarianceDecision.RECOVER
                ),

                countDecision(
                        items,
                        FlywheelVarianceDecision.WRITE_OFF
                ),

                countDecision(
                        items,
                        FlywheelVarianceDecision.INVESTIGATE
                ),

                row.planOwnerUserId(),
                row.planOwnerName(),

                row.resolutionObjective(),

                row.status(),

                row.submittedByName(),
                row.submittedAt(),

                row.approvalNote(),
                row.approvedByName(),
                row.approvedAt(),

                row.closeNote(),
                row.closedByName(),
                row.closedAt(),

                row.createdAt(),
                row.updatedAt(),

                row.version()
        );
    }

    private FlywheelVarianceItemResponse itemResponse(
            FlywheelVarianceRepository.ItemRow row
    ) {
        return new FlywheelVarianceItemResponse(
                row.id(),
                row.variancePlanId(),

                row.settlementItemId(),

                row.releaseItemId(),
                row.allocationItemId(),

                row.flywheelLineageId(),
                row.lineageNumber(),

                row.rootTargetInitiativeTitle(),

                policy.money(
                        row.sourceReleasedAmount()
                ),

                policy.money(
                        row.sourceSettledAmount()
                ),

                policy.money(
                        row.sourceVarianceAmount()
                ),

                row.sourceReconciliationStatus(),

                row.decision(),

                row.decisionRationale(),

                row.targetDate(),

                row.addedByName(),
                row.addedAt()
        );
    }

    private FlywheelVarianceSummaryResponse summary(
            int eligibleSettlementCount,
            List<FlywheelVariancePlanResponse> plans
    ) {
        List<FlywheelVariancePlanResponse> finalized =
                plans
                        .stream()
                        .filter(
                                plan ->
                                        plan.status()
                                                == FlywheelVariancePlanStatus.APPROVED
                                        ||
                                        plan.status()
                                                == FlywheelVariancePlanStatus.CLOSED
                        )
                        .toList();

        return new FlywheelVarianceSummaryResponse(
                eligibleSettlementCount,

                plans.size(),

                countStatus(
                        plans,
                        FlywheelVariancePlanStatus.DRAFT
                ),

                countStatus(
                        plans,
                        FlywheelVariancePlanStatus.IN_REVIEW
                ),

                countStatus(
                        plans,
                        FlywheelVariancePlanStatus.APPROVED
                ),

                countStatus(
                        plans,
                        FlywheelVariancePlanStatus.CLOSED
                ),

                CurrencyTotals.sum(
                        finalized,
                        FlywheelVariancePlanResponse::currency,
                        FlywheelVariancePlanResponse::recoverAmount
                ),

                CurrencyTotals.sum(
                        finalized,
                        FlywheelVariancePlanResponse::currency,
                        FlywheelVariancePlanResponse::writeOffAmount
                ),

                CurrencyTotals.sum(
                        finalized,
                        FlywheelVariancePlanResponse::currency,
                        FlywheelVariancePlanResponse::investigationAmount
                )
        );
    }

    private int countStatus(
            List<FlywheelVariancePlanResponse> plans,
            FlywheelVariancePlanStatus status
    ) {
        return (int)
                plans
                        .stream()
                        .filter(
                                plan ->
                                        plan.status()
                                                == status
                        )
                        .count();
    }

    private int countDecision(
            List<FlywheelVarianceRepository.ItemRow> items,
            FlywheelVarianceDecision decision
    ) {
        return (int)
                items
                        .stream()
                        .filter(
                                item ->
                                        item.decision()
                                                == decision
                        )
                        .count();
    }

    private FlywheelVarianceSnapshotSummaryResponse snapshotSummary(
            FlywheelVarianceRepository.SnapshotRow row
    ) {
        return new FlywheelVarianceSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),

                row.variancePlanId(),
                row.planNumber(),

                row.settlementCaseId(),
                row.reconciliationNumber(),

                row.planStatus(),

                row.currency(),
                row.fiscalYear(),

                policy.money(
                        row.sourceVarianceAmount()
                ),

                policy.money(
                        row.governedAmount()
                ),

                policy.money(
                        row.recoverAmount()
                ),

                policy.money(
                        row.writeOffAmount()
                ),

                policy.money(
                        row.investigationAmount()
                ),

                row.coveragePct(),

                row.itemCount(),
                row.recoverCount(),
                row.writeOffCount(),
                row.investigationCount(),

                row.capturedByName(),
                row.capturedAt()
        );
    }

    private FlywheelVarianceSnapshotItemResponse snapshotItemResponse(
            FlywheelVarianceRepository.SnapshotItemRow row
    ) {
        return new FlywheelVarianceSnapshotItemResponse(
                row.settlementItemId(),

                row.flywheelLineageId(),
                row.lineageNumber(),

                row.rootTargetInitiativeTitle(),

                policy.money(
                        row.sourceVarianceAmount()
                ),

                row.decision(),

                row.decisionRationale(),

                row.targetDate()
        );
    }

    private FlywheelVarianceRepository.PlanRow requireLockedPlan(
            UUID planId
    ) {
        FlywheelVarianceRepository.PlanRow observed =
                requirePlan(
                        planId
                );

        repository.lockSettlementCase(
                observed.settlementCaseId()
        );

        repository.lockPlan(
                planId
        );

        FlywheelVarianceRepository.PlanRow current =
                requirePlan(
                        planId
                );

        if (
                !current
                        .settlementCaseId()
                        .equals(
                                observed.settlementCaseId()
                        )
        ) {
            throw new IllegalStateException(
                    "Variance-plan source settlement changed while acquiring the governance lock."
            );
        }

        return current;
    }

    private FlywheelVarianceRepository.PlanRow requirePlan(
            UUID planId
    ) {
        FlywheelVarianceRepository.PlanRow plan =
                repository.findPlan(
                        planId
                );

        if (
                plan == null
        ) {
            throw new ResourceNotFoundException(
                    "Flywheel variance plan not found: "
                            + planId
            );
        }

        return plan;
    }

    private AppUserEntity requirePlanOwner(
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
                    "Requester accounts cannot own variance-resolution plans."
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

    private String nextPlanNumber() {
        return String.format(
                "FWVAR-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                ).getValue(),
                repository.nextPlanSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "FWVARSNAP-%d-%05d",
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
                    "Your ProcureIQ role cannot access settlement variance governance."
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
                    "Your ProcureIQ role cannot prepare variance-resolution plans."
            );
        }
    }

    private void assertApproveRole(
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
                    "Only administrators and procurement managers can approve variance-resolution plans."
            );
        }
    }
}
