package com.procureiq.capitalallocation;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.strategicvalue.StrategicValueCaseResponse;
import com.procureiq.strategicvalue.StrategicValueCaseStatus;
import com.procureiq.strategicvalue.StrategicValueDashboardResponse;
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
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class CapitalAllocationService {

    private final CapitalAllocationRepository repository;

    private final CapitalAllocationMathService mathService;

    private final StrategicValueService strategicValueService;

    private final AppUserRepository appUserRepository;

    public CapitalAllocationService(
            CapitalAllocationRepository repository,
            CapitalAllocationMathService mathService,
            StrategicValueService strategicValueService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.strategicValueService =
                strategicValueService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public CapitalAllocationDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<CapitalAllocationCandidateResponse> candidates =
                valueCandidates(
                        currentUserId
                );

        List<CapitalAllocationCycleResponse> cycles =
                repository
                        .cycles()
                        .stream()
                        .map(
                                this::cycleResponse
                        )
                        .toList();

        return new CapitalAllocationDashboardResponse(
                new CapitalAllocationDashboardSummaryResponse(
                        candidates.size(),
                        cycles.size(),
                        countCycleStatus(
                                cycles,
                                CapitalAllocationCycleStatus.DRAFT
                        ),
                        countCycleStatus(
                                cycles,
                                CapitalAllocationCycleStatus.IN_REVIEW
                        ),
                        countCycleStatus(
                                cycles,
                                CapitalAllocationCycleStatus.APPROVED
                        ),
                        countCycleStatus(
                                cycles,
                                CapitalAllocationCycleStatus.CLOSED
                        )
                ),
                candidates,
                cycles,
                repository
                        .snapshots()
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public CapitalAllocationCycleDetailResponse createCycle(
            UUID currentUserId,
            CapitalAllocationCycleInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        UUID cycleId =
                UUID.randomUUID();

        repository.createCycle(
                cycleId,
                nextCycleNumber(),
                input,
                currentUserId
        );

        return cycle(
                currentUserId,
                cycleId
        );
    }

    @Transactional(readOnly = true)
    public CapitalAllocationCycleDetailResponse cycle(
            UUID currentUserId,
            UUID cycleId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalAllocationRepository.CycleRow cycle =
                requireCycle(
                        cycleId
                );

        List<CapitalAllocationItemResponse> items =
                repository
                        .items(
                                cycleId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        Set<UUID> existingValueCases =
                items.stream()
                        .map(
                                CapitalAllocationItemResponse::
                                        valueCaseId
                        )
                        .collect(
                                Collectors.toSet()
                        );

        List<CapitalAllocationCandidateResponse> candidates =
                valueCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                candidate ->
                                        candidate
                                                .currency()
                                                .equalsIgnoreCase(
                                                        cycle.currency()
                                                )
                        )
                        .filter(
                                candidate ->
                                        candidate.fiscalYear()
                                                == cycle.fiscalYear()
                        )
                        .filter(
                                candidate ->
                                        !existingValueCases
                                                .contains(
                                                        candidate.valueCaseId()
                                                )
                        )
                        .toList();

        return new CapitalAllocationCycleDetailResponse(
                cycleResponse(
                        cycle
                ),
                candidates,
                items
        );
    }

    public CapitalAllocationCycleDetailResponse addItem(
            UUID currentUserId,
            UUID cycleId,
            CapitalAllocationItemInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalAllocationRepository.CycleRow cycle =
                requireCycle(
                        cycleId
                );

        if (
                cycle.status()
                        != CapitalAllocationCycleStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Capital-allocation items can be added only while a cycle is in DRAFT."
            );
        }

        StrategicValueCaseResponse valueCase =
                currentValueCase(
                        currentUserId,
                        input.valueCaseId()
                );

        if (!eligibleValueCase(
                valueCase
        )) {
            throw new IllegalArgumentException(
                    "Capital allocation requires a verified or closed Step 56 strategic value case."
            );
        }

        if (
                !cycle.currency()
                        .equalsIgnoreCase(
                                valueCase.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Value case currency does not match the allocation cycle currency."
            );
        }

        if (
                cycle.fiscalYear()
                        != valueCase.fiscalYear()
        ) {
            throw new IllegalArgumentException(
                    "Value case fiscal year does not match the allocation cycle fiscal year."
            );
        }

        boolean duplicate =
                repository
                        .items(
                                cycleId
                        )
                        .stream()
                        .anyMatch(
                                item ->
                                        item.valueCaseId()
                                                .equals(
                                                        valueCase.id()
                                                )
                        );

        if (duplicate) {
            throw new IllegalArgumentException(
                    "This strategic value case is already present in the allocation cycle."
            );
        }

        CapitalAllocationCandidateResponse candidate =
                candidateResponse(
                        valueCase
                );

        repository.addItem(
                UUID.randomUUID(),
                cycleId,
                candidate,
                input.requestedCapitalAmount(),
                currentUserId
        );

        return cycle(
                currentUserId,
                cycleId
        );
    }

    public CapitalAllocationCycleDetailResponse removeItem(
            UUID currentUserId,
            UUID itemId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalAllocationRepository.ItemRow item =
                requireItem(
                        itemId
                );

        CapitalAllocationRepository.CycleRow cycle =
                requireCycle(
                        item.cycleId()
                );

        if (
                cycle.status()
                        != CapitalAllocationCycleStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Capital-allocation items can be removed only while a cycle is in DRAFT."
            );
        }

        repository.removeItem(
                itemId
        );

        return cycle(
                currentUserId,
                item.cycleId()
        );
    }

    public CapitalAllocationCycleDetailResponse submitCycle(
            UUID currentUserId,
            UUID cycleId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalAllocationRepository.CycleRow cycle =
                requireCycle(
                        cycleId
                );

        if (
                cycle.status()
                        != CapitalAllocationCycleStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only a draft allocation cycle can be submitted for review."
            );
        }

        if (
                repository
                        .items(
                                cycleId
                        )
                        .isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "At least one strategic value case is required before allocation review."
            );
        }

        repository.submitCycle(
                cycleId
        );

        return cycle(
                currentUserId,
                cycleId
        );
    }

    public CapitalAllocationCycleDetailResponse decideItem(
            UUID currentUserId,
            UUID itemId,
            CapitalAllocationDecisionInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                input.decision()
                        == CapitalAllocationDecision.PENDING
        ) {
            throw new IllegalArgumentException(
                    "Investment-committee decisions cannot be set back to PENDING."
            );
        }

        CapitalAllocationRepository.ItemRow item =
                requireItem(
                        itemId
                );

        CapitalAllocationRepository.CycleRow cycle =
                requireCycle(
                        item.cycleId()
                );

        if (
                cycle.status()
                        != CapitalAllocationCycleStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Funding decisions can be recorded only while the allocation cycle is IN_REVIEW."
            );
        }

        if (
                input.decision()
                        == CapitalAllocationDecision.FUND
        ) {
            BigDecimal otherFunded =
                    repository
                            .items(
                                    item.cycleId()
                            )
                            .stream()
                            .filter(
                                    candidate ->
                                            !candidate
                                                    .id()
                                                    .equals(
                                                            item.id()
                                                    )
                            )
                            .filter(
                                    candidate ->
                                            candidate.decision()
                                                    == CapitalAllocationDecision.FUND
                            )
                            .map(
                                    CapitalAllocationRepository.ItemRow::
                                            requestedCapitalAmount
                            )
                            .map(
                                    mathService::money
                            )
                            .reduce(
                                    BigDecimal.ZERO,
                                    BigDecimal::add
                            );

            BigDecimal resultingFunded =
                    otherFunded
                            .add(
                                    mathService.money(
                                            item.requestedCapitalAmount()
                                    )
                            );

            if (
                    resultingFunded.compareTo(
                            mathService.money(
                                    cycle.budgetAmount()
                            )
                    )
                    > 0
            ) {
                throw new IllegalArgumentException(
                        "Funding this item would exceed the governed allocation-cycle budget."
                );
            }
        }

        repository.decideItem(
                itemId,
                input,
                currentUserId
        );

        return cycle(
                currentUserId,
                item.cycleId()
        );
    }

    public CapitalAllocationCycleDetailResponse approveCycle(
            UUID currentUserId,
            UUID cycleId,
            CapitalAllocationNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalAllocationRepository.CycleRow cycle =
                requireCycle(
                        cycleId
                );

        if (
                cycle.status()
                        != CapitalAllocationCycleStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only an allocation cycle in review can be approved."
            );
        }

        List<CapitalAllocationItemResponse> items =
                repository
                        .items(
                                cycleId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        if (items.isEmpty()) {
            throw new IllegalArgumentException(
                    "Allocation cycle cannot be approved without investment candidates."
            );
        }

        boolean pending =
                items.stream()
                        .anyMatch(
                                item ->
                                        item.decision()
                                                == CapitalAllocationDecision.PENDING
                        );

        if (pending) {
            throw new IllegalArgumentException(
                    "Every allocation item requires an explicit FUND, DEFER, or REJECT decision before approval."
            );
        }

        CapitalAllocationPortfolioResult portfolio =
                portfolio(
                        cycle,
                        items
                );

        if (
                portfolio
                        .fundedAmount()
                        .compareTo(
                                mathService.money(
                                        cycle.budgetAmount()
                                )
                        )
                > 0
        ) {
            throw new IllegalArgumentException(
                    "Funded capital exceeds the governed allocation-cycle budget."
            );
        }

        repository.approveCycle(
                cycleId,
                input.note(),
                currentUserId
        );

        CapitalAllocationCycleDetailResponse approved =
                cycle(
                        currentUserId,
                        cycleId
                );

        captureSnapshotInternal(
                currentUserId,
                approved
        );

        return approved;
    }

    public CapitalAllocationCycleDetailResponse closeCycle(
            UUID currentUserId,
            UUID cycleId,
            CapitalAllocationNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalAllocationRepository.CycleRow cycle =
                requireCycle(
                        cycleId
                );

        if (
                cycle.status()
                        != CapitalAllocationCycleStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Only an approved allocation cycle can be closed."
            );
        }

        repository.closeCycle(
                cycleId,
                input.note(),
                currentUserId
        );

        return cycle(
                currentUserId,
                cycleId
        );
    }

    public CapitalAllocationSnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            UUID cycleId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalAllocationCycleDetailResponse cycle =
                cycle(
                        currentUserId,
                        cycleId
                );

        return captureSnapshotInternal(
                currentUserId,
                cycle
        );
    }

    @Transactional(readOnly = true)
    public CapitalAllocationSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalAllocationRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Capital-allocation snapshot not found: "
                            + snapshotId
            );
        }

        return new CapitalAllocationSnapshotDetailResponse(
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

    private CapitalAllocationSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId,
            CapitalAllocationCycleDetailResponse detail
    ) {
        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                detail.cycle(),
                currentUserId
        );

        for (
                CapitalAllocationItemResponse item
                : detail.items()
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    item
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<CapitalAllocationCandidateResponse> valueCandidates(
            UUID currentUserId
    ) {
        StrategicValueDashboardResponse valueDashboard =
                strategicValueService
                        .dashboard(
                                currentUserId
                        );

        return valueDashboard
                .cases()
                .stream()
                .filter(
                        this::eligibleValueCase
                )
                .map(
                        this::candidateResponse
                )
                .toList();
    }

    private CapitalAllocationCandidateResponse candidateResponse(
            StrategicValueCaseResponse valueCase
    ) {
        CapitalAllocationPriorityResult priority =
                mathService
                        .priority(
                                valueCase.roiPct(),
                                valueCase.paybackMonths(),
                                valueCase.persistencePct(),
                                valueCase.valueHealth(),
                                valueCase.netValueAmount()
                        );

        return new CapitalAllocationCandidateResponse(
                valueCase.id(),
                valueCase.caseNumber(),
                valueCase.persistencePlanNumber(),
                valueCase.commitmentNumber(),
                valueCase.initiativeNumber(),
                valueCase.initiativeTitle(),
                valueCase.valueOwnerName(),
                valueCase.currency(),
                valueCase.fiscalYear(),
                mathService.money(
                        valueCase.investmentCostAmount()
                ),
                mathService.money(
                        valueCase.durableHorizonValueAmount()
                ),
                mathService.money(
                        valueCase.netValueAmount()
                ),
                mathService.decimal(
                        valueCase.roiPct()
                ),
                valueCase.paybackMonths() == null
                        ? null
                        : mathService.decimal(
                                valueCase.paybackMonths()
                        ),
                mathService.bounded(
                        valueCase.persistencePct()
                ),
                valueCase.valueHealth(),
                priority.priorityScore(),
                priority.recommendation()
        );
    }

    private CapitalAllocationCycleResponse cycleResponse(
            CapitalAllocationRepository.CycleRow cycle
    ) {
        List<CapitalAllocationItemResponse> items =
                repository
                        .items(
                                cycle.id()
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        CapitalAllocationPortfolioResult portfolio =
                portfolio(
                        cycle,
                        items
                );

        return new CapitalAllocationCycleResponse(
                cycle.id(),
                cycle.cycleNumber(),
                cycle.title(),
                cycle.currency(),
                cycle.fiscalYear(),
                mathService.money(
                        cycle.budgetAmount()
                ),
                cycle.objective(),
                cycle.status(),

                portfolio.fundedAmount(),
                portfolio.remainingBudgetAmount(),
                portfolio.budgetUtilizationPct(),
                portfolio.fundedNetValueAmount(),
                portfolio.opportunityCostAmount(),

                mathService
                        .averagePriority(
                                items.stream()
                                        .map(
                                                CapitalAllocationItemResponse::
                                                        priorityScore
                                        )
                                        .toList()
                        ),

                items.size(),
                countDecision(
                        items,
                        CapitalAllocationDecision.FUND
                ),
                countDecision(
                        items,
                        CapitalAllocationDecision.DEFER
                ),
                countDecision(
                        items,
                        CapitalAllocationDecision.REJECT
                ),
                countDecision(
                        items,
                        CapitalAllocationDecision.PENDING
                ),

                cycle.approvedByName(),
                cycle.approvedAt(),
                cycle.approvalNote(),
                cycle.closedByName(),
                cycle.closedAt(),
                cycle.closeNote(),
                cycle.createdAt(),
                cycle.updatedAt(),
                cycle.version()
        );
    }

    private CapitalAllocationItemResponse itemResponse(
            CapitalAllocationRepository.ItemRow row
    ) {
        return new CapitalAllocationItemResponse(
                row.id(),
                row.cycleId(),
                row.valueCaseId(),
                row.caseNumber(),
                row.persistencePlanNumber(),
                row.commitmentNumber(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                row.valueOwnerName(),
                row.currency(),
                row.fiscalYear(),
                mathService.money(
                        row.requestedCapitalAmount()
                ),
                mathService.money(
                        row.investmentCostSnapshot()
                ),
                mathService.money(
                        row.durableHorizonValueSnapshot()
                ),
                mathService.money(
                        row.netValueSnapshot()
                ),
                mathService.decimal(
                        row.roiPctSnapshot()
                ),
                row.paybackMonthsSnapshot() == null
                        ? null
                        : mathService.decimal(
                                row.paybackMonthsSnapshot()
                        ),
                mathService.bounded(
                        row.persistencePctSnapshot()
                ),
                row.valueHealthSnapshot(),
                mathService.bounded(
                        row.priorityScore()
                ),
                row.recommendation(),
                row.decision(),
                row.decisionNote(),
                row.decidedByName(),
                row.decidedAt(),
                row.createdAt()
        );
    }

    private CapitalAllocationPortfolioResult portfolio(
            CapitalAllocationRepository.CycleRow cycle,
            List<CapitalAllocationItemResponse> items
    ) {
        return mathService
                .portfolio(
                        cycle.budgetAmount(),
                        items.stream()
                                .map(
                                        item ->
                                                new CapitalAllocationMathService.CapitalAllocationPortfolioItem(
                                                        item.decision(),
                                                        item.requestedCapitalAmount(),
                                                        item.netValueSnapshot()
                                                )
                                )
                                .toList()
                );
    }

    private CapitalAllocationSnapshotSummaryResponse snapshotSummary(
            CapitalAllocationRepository.SnapshotRow row
    ) {
        return new CapitalAllocationSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.cycleId(),
                row.cycleNumber(),
                row.cycleTitle(),
                row.currency(),
                row.fiscalYear(),
                row.cycleStatus(),
                mathService.money(
                        row.budgetAmount()
                ),
                mathService.money(
                        row.fundedAmount()
                ),
                mathService.money(
                        row.remainingBudgetAmount()
                ),
                mathService.bounded(
                        row.budgetUtilizationPct()
                ),
                mathService.money(
                        row.fundedNetValueAmount()
                ),
                mathService.money(
                        row.opportunityCostAmount()
                ),
                mathService.bounded(
                        row.averagePriorityScore()
                ),
                row.itemCount(),
                row.fundedItemCount(),
                row.deferredItemCount(),
                row.rejectedItemCount(),
                row.pendingItemCount(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private CapitalAllocationSnapshotItemResponse snapshotItemResponse(
            CapitalAllocationRepository.SnapshotItemRow row
    ) {
        return new CapitalAllocationSnapshotItemResponse(
                row.allocationItemId(),
                row.caseNumber(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                mathService.money(
                        row.requestedCapitalAmount()
                ),
                mathService.money(
                        row.durableHorizonValueAmount()
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
                mathService.bounded(
                        row.persistencePct()
                ),
                row.valueHealth(),
                mathService.bounded(
                        row.priorityScore()
                ),
                row.recommendation(),
                row.decision(),
                row.decisionNote()
        );
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

    private boolean eligibleValueCase(
            StrategicValueCaseResponse valueCase
    ) {
        return valueCase.status()
                == StrategicValueCaseStatus.VERIFIED
                ||
                valueCase.status()
                        == StrategicValueCaseStatus.CLOSED;
    }

    private CapitalAllocationRepository.CycleRow requireCycle(
            UUID cycleId
    ) {
        CapitalAllocationRepository.CycleRow cycle =
                repository
                        .findCycle(
                                cycleId
                        );

        if (cycle == null) {
            throw new ResourceNotFoundException(
                    "Capital-allocation cycle not found: "
                            + cycleId
            );
        }

        return cycle;
    }

    private CapitalAllocationRepository.ItemRow requireItem(
            UUID itemId
    ) {
        CapitalAllocationRepository.ItemRow item =
                repository
                        .findItem(
                                itemId
                        );

        if (item == null) {
            throw new ResourceNotFoundException(
                    "Capital-allocation item not found: "
                            + itemId
            );
        }

        return item;
    }

    private int countCycleStatus(
            List<CapitalAllocationCycleResponse> cycles,
            CapitalAllocationCycleStatus status
    ) {
        return (
                int
        ) cycles.stream()
                .filter(
                        cycle ->
                                cycle.status()
                                        == status
                )
                .count();
    }

    private int countDecision(
            List<CapitalAllocationItemResponse> items,
            CapitalAllocationDecision decision
    ) {
        return (
                int
        ) items.stream()
                .filter(
                        item ->
                                item.decision()
                                        == decision
                )
                .count();
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

    private String nextCycleNumber() {
        return String.format(
                "CAP-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextCycleSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "CAPSNAP-%d-%05d",
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
                    "Your ProcureIQ role cannot access capital-allocation governance."
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
                    "Your ProcureIQ role cannot manage capital-allocation planning."
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
                    "Only administrators and procurement managers can make or approve capital-allocation decisions."
            );
        }
    }
}
