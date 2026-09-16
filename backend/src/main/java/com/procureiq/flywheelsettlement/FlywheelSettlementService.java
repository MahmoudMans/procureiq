package com.procureiq.flywheelsettlement;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.common.money.CurrencyTotals;
import com.procureiq.flywheelrelease.FlywheelReleaseBatchDetailResponse;
import com.procureiq.flywheelrelease.FlywheelReleaseBatchResponse;
import com.procureiq.flywheelrelease.FlywheelReleaseBatchStatus;
import com.procureiq.flywheelrelease.FlywheelReleaseItemResponse;
import com.procureiq.flywheelrelease.FlywheelReleaseItemStatus;
import com.procureiq.flywheelrelease.FlywheelReleaseService;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(
        isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED
)
public class FlywheelSettlementService {

    private final FlywheelSettlementRepository repository;

    private final FlywheelSettlementPolicyService policy;

    private final FlywheelReleaseService releaseService;

    private final AppUserRepository appUserRepository;

    public FlywheelSettlementService(
            FlywheelSettlementRepository repository,
            FlywheelSettlementPolicyService policy,
            FlywheelReleaseService releaseService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.policy =
                policy;

        this.releaseService =
                releaseService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public FlywheelSettlementDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        List<FlywheelSettlementReleaseAuthorityResponse> releases =
                eligibleReleases(
                        currentUserId
                );

        List<FlywheelSettlementCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .map(
                                this::caseResponse
                        )
                        .toList();

        return new FlywheelSettlementDashboardResponse(
                summary(
                        releases.size(),
                        cases
                ),

                repository.users(),

                releases,

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

    public FlywheelSettlementCaseDetailResponse createCase(
            UUID currentUserId,
            FlywheelSettlementCaseInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        repository.lockReleaseBatch(
                input.releaseBatchId()
        );

        FlywheelReleaseBatchDetailResponse release =
                requireFinalizedRelease(
                        currentUserId,
                        input.releaseBatchId()
                );

        if (
                repository.hasCaseForReleaseBatch(
                        input.releaseBatchId()
                )
        ) {
            throw new IllegalArgumentException(
                    "This release batch already has a settlement reconciliation case."
            );
        }

        AppUserEntity owner =
                requireSettlementOwner(
                        input.reconciliationOwnerUserId()
                );

        FlywheelSettlementReleaseAuthorityResponse authority =
                releaseAuthority(
                        release
                );

        UUID caseId =
                UUID.randomUUID();

        repository.createCase(
                caseId,
                nextCaseNumber(),
                input,
                authority,
                owner.getFullName(),
                currentUserId
        );

        return settlementCase(
                currentUserId,
                caseId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelSettlementCaseDetailResponse settlementCase(
            UUID currentUserId,
            UUID caseId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelSettlementRepository.CaseRow settlementCase =
                requireCase(
                        caseId
                );

        FlywheelReleaseBatchDetailResponse release =
                releaseService.batch(
                        currentUserId,
                        settlementCase.releaseBatchId()
                );

        List<FlywheelSettlementRepository.ItemRow> currentItems =
                repository.items(
                        caseId
                );

        List<FlywheelSettlementCandidateItemResponse> candidates =
                release
                        .items()
                        .stream()
                        .filter(
                                item ->
                                        item.status()
                                                == FlywheelReleaseItemStatus.RELEASED
                        )
                        .filter(
                                item ->
                                        currentItems
                                                .stream()
                                                .noneMatch(
                                                        existing ->
                                                                existing
                                                                        .releaseItemId()
                                                                        .equals(
                                                                                item.id()
                                                                        )
                                                )
                        )
                        .map(
                                this::candidateItem
                        )
                        .toList();

        return new FlywheelSettlementCaseDetailResponse(
                caseResponse(
                        settlementCase
                ),

                releaseAuthority(
                        release
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

    public FlywheelSettlementCaseDetailResponse addItem(
            UUID currentUserId,
            UUID caseId,
            FlywheelSettlementItemInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelSettlementRepository.CaseRow settlementCase =
                requireLockedCase(
                        caseId
                );

        if (
                settlementCase.status()
                        != FlywheelSettlementCaseStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Settlement evidence can be added only while the case is DRAFT."
            );
        }

        FlywheelReleaseBatchDetailResponse release =
                requireFinalizedRelease(
                        currentUserId,
                        settlementCase.releaseBatchId()
                );

        validateReleaseAuthority(
                settlementCase,
                release
        );

        FlywheelReleaseItemResponse source =
                release
                        .items()
                        .stream()
                        .filter(
                                item ->
                                        item.id()
                                                .equals(
                                                        input.releaseItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Release item does not belong to the source Step 69/70 batch."
                                        )
                        );

        if (
                source.status()
                        != FlywheelReleaseItemStatus.RELEASED
        ) {
            throw new IllegalArgumentException(
                    "Only RELEASED Step 69/70 items can be reconciled."
            );
        }

        if (
                repository
                        .items(
                                caseId
                        )
                        .stream()
                        .anyMatch(
                                item ->
                                        item.releaseItemId()
                                                .equals(
                                                        source.id()
                                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "This release item already has settlement evidence in the case."
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
                        "Evidence note"
                );

        FlywheelSettlementClassificationResult result =
                policy.classify(
                        source.plannedReleaseAmount(),
                        input.settledAmount(),
                        reference
                );

        repository.createItem(
                UUID.randomUUID(),
                caseId,
                candidateItem(
                        source
                ),
                result,
                input,
                reference,
                note,
                currentUserId
        );

        return settlementCase(
                currentUserId,
                caseId
        );
    }

    public FlywheelSettlementCaseDetailResponse submitForReview(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelSettlementRepository.CaseRow settlementCase =
                requireLockedCase(
                        caseId
                );

        if (
                settlementCase.status()
                        != FlywheelSettlementCaseStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only a DRAFT settlement case can enter review."
            );
        }

        FlywheelReleaseBatchDetailResponse release =
                requireFinalizedRelease(
                        currentUserId,
                        settlementCase.releaseBatchId()
                );

        validateReleaseAuthority(
                settlementCase,
                release
        );

        List<FlywheelReleaseItemResponse> releasedItems =
                release
                        .items()
                        .stream()
                        .filter(
                                item ->
                                        item.status()
                                                == FlywheelReleaseItemStatus.RELEASED
                        )
                        .toList();

        List<FlywheelSettlementRepository.ItemRow> settlementItems =
                repository.items(
                        caseId
                );

        if (
                releasedItems.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "Source release batch contains no released items."
            );
        }

        if (
                settlementItems.size()
                        != releasedItems.size()
        ) {
            throw new IllegalArgumentException(
                    "Every RELEASED source item requires settlement evidence before review."
            );
        }

        for (
                FlywheelSettlementRepository.ItemRow settlementItem
                : settlementItems
        ) {
            validateSettlementItemAuthority(
                    releasedItems,
                    settlementItem
            );
        }

        BigDecimal capturedSource =
                settlementItems
                        .stream()
                        .map(
                                FlywheelSettlementRepository.ItemRow::
                                        sourceReleasedAmount
                        )
                        .map(
                                policy::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        if (
                capturedSource.compareTo(
                        policy.money(
                                settlementCase.sourceReleasedAmount()
                        )
                ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Captured settlement-item authority does not equal the release-batch amount."
            );
        }

        policy.metrics(
                settlementCase.sourceReleasedAmount(),

                settlementItems
                        .stream()
                        .map(
                                FlywheelSettlementRepository.ItemRow::
                                        settledAmount
                        )
                        .toList()
        );

        int updated =
                repository.submitForReview(
                        caseId,
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Settlement case state changed before review submission."
            );
        }

        return settlementCase(
                currentUserId,
                caseId
        );
    }

    public FlywheelSettlementCaseDetailResponse reconcile(
            UUID currentUserId,
            UUID caseId,
            FlywheelSettlementNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelSettlementRepository.CaseRow settlementCase =
                requireLockedCase(
                        caseId
                );

        if (
                settlementCase.status()
                        != FlywheelSettlementCaseStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only an IN_REVIEW settlement case can be reconciled."
            );
        }

        FlywheelReleaseBatchDetailResponse release =
                requireFinalizedRelease(
                        currentUserId,
                        settlementCase.releaseBatchId()
                );

        validateReleaseAuthority(
                settlementCase,
                release
        );

        List<FlywheelSettlementRepository.ItemRow> items =
                repository.items(
                        caseId
                );

        if (items.isEmpty()) {
            throw new IllegalArgumentException(
                    "Settlement case contains no evidence."
            );
        }

        String note =
                policy.requiredText(
                        input.note(),
                        5000,
                        "Reconciliation note"
                );

        policy.metrics(
                settlementCase.sourceReleasedAmount(),

                items
                        .stream()
                        .map(
                                FlywheelSettlementRepository.ItemRow::
                                        settledAmount
                        )
                        .toList()
        );

        int updated =
                repository.reconcile(
                        caseId,
                        note,
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Settlement case state changed before reconciliation."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                caseId
        );

        return settlementCase(
                currentUserId,
                caseId
        );
    }

    public FlywheelSettlementCaseDetailResponse close(
            UUID currentUserId,
            UUID caseId,
            FlywheelSettlementNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelSettlementRepository.CaseRow settlementCase =
                requireLockedCase(
                        caseId
                );

        if (
                settlementCase.status()
                        != FlywheelSettlementCaseStatus.RECONCILED
        ) {
            throw new IllegalArgumentException(
                    "Only a RECONCILED settlement case can be closed."
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

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Settlement case state changed before closure."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                caseId
        );

        return settlementCase(
                currentUserId,
                caseId
        );
    }

    public FlywheelSettlementSnapshotDetailResponse captureSnapshot(
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
    public FlywheelSettlementSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelSettlementRepository.SnapshotRow snapshot =
                repository.findSnapshot(
                        snapshotId
                );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Flywheel settlement snapshot not found: "
                            + snapshotId
            );
        }

        return new FlywheelSettlementSnapshotDetailResponse(
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

    private FlywheelSettlementSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId,
            UUID caseId
    ) {
        FlywheelSettlementRepository.CaseRow row =
                requireLockedCase(
                        caseId
                );

        List<FlywheelSettlementItemResponse> items =
                repository
                        .items(
                                caseId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        FlywheelSettlementCaseResponse response =
                caseResponse(
                        row
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
                FlywheelSettlementItemResponse item
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
                    "Settlement snapshot could not be sealed."
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<FlywheelSettlementReleaseAuthorityResponse> eligibleReleases(
            UUID currentUserId
    ) {
        return releaseService
                .dashboard(
                        currentUserId
                )
                .batches()
                .stream()
                .filter(
                        batch ->
                                batch.status()
                                        == FlywheelReleaseBatchStatus.EXECUTED
                                ||
                                batch.status()
                                        == FlywheelReleaseBatchStatus.CLOSED
                )
                .filter(
                        batch ->
                                batch.batchReleasedAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        ) > 0
                )
                .filter(
                        batch ->
                                !repository.hasCaseForReleaseBatch(
                                        batch.id()
                                )
                )
                .map(
                        batch ->
                                releaseAuthority(
                                        releaseService.batch(
                                                currentUserId,
                                                batch.id()
                                        )
                                )
                )
                .toList();
    }

    private FlywheelReleaseBatchDetailResponse requireFinalizedRelease(
            UUID currentUserId,
            UUID releaseBatchId
    ) {
        FlywheelReleaseBatchDetailResponse detail =
                releaseService.batch(
                        currentUserId,
                        releaseBatchId
                );

        FlywheelReleaseBatchStatus status =
                detail
                        .batch()
                        .status();

        if (
                status
                        != FlywheelReleaseBatchStatus.EXECUTED
                &&
                status
                        != FlywheelReleaseBatchStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Step 71 requires an EXECUTED or CLOSED Step 69/70 release batch."
            );
        }

        if (
                detail
                        .batch()
                        .batchReleasedAmount()
                        .compareTo(
                                BigDecimal.ZERO
                        ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "Release batch contains no recorded released amount."
            );
        }

        return detail;
    }

    private FlywheelSettlementReleaseAuthorityResponse releaseAuthority(
            FlywheelReleaseBatchDetailResponse detail
    ) {
        FlywheelReleaseBatchResponse batch =
                detail.batch();

        int releasedItemCount =
                (int)
                        detail
                                .items()
                                .stream()
                                .filter(
                                        item ->
                                                item.status()
                                                        == FlywheelReleaseItemStatus.RELEASED
                                )
                                .count();

        return new FlywheelSettlementReleaseAuthorityResponse(
                batch.id(),
                batch.releaseNumber(),

                batch.allocationMandateId(),
                batch.allocationMandateNumber(),

                batch.strategyPortfolioId(),
                batch.strategyPortfolioNumber(),

                batch.title(),

                batch.currency(),
                batch.fiscalYear(),

                policy.money(
                        batch.batchReleasedAmount()
                ),

                releasedItemCount,

                batch.releaseOwnerName(),
                batch.releaseRationale(),

                batch.status()
        );
    }

    private FlywheelSettlementCandidateItemResponse candidateItem(
            FlywheelReleaseItemResponse item
    ) {
        return new FlywheelSettlementCandidateItemResponse(
                item.id(),
                item.allocationItemId(),

                item.flywheelLineageId(),
                item.lineageNumber(),

                item.rootTargetInitiativeTitle(),

                policy.money(
                        item.plannedReleaseAmount()
                ),

                item.executionReference()
        );
    }

    private void validateReleaseAuthority(
            FlywheelSettlementRepository.CaseRow settlementCase,
            FlywheelReleaseBatchDetailResponse release
    ) {
        FlywheelReleaseBatchResponse batch =
                release.batch();

        if (
                !batch
                        .releaseNumber()
                        .equals(
                                settlementCase.releaseNumber()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Release identity changed after settlement-case creation."
            );
        }

        if (
                !batch
                        .allocationMandateId()
                        .equals(
                                settlementCase.allocationMandateId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Allocation mandate authority changed after settlement-case creation."
            );
        }

        if (
                !batch
                        .strategyPortfolioId()
                        .equals(
                                settlementCase.strategyPortfolioId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Strategy authority changed after settlement-case creation."
            );
        }

        if (
                !batch
                        .currency()
                        .equalsIgnoreCase(
                                settlementCase.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Release currency changed after settlement-case creation."
            );
        }

        if (
                policy
                        .money(
                                batch.batchReleasedAmount()
                        )
                        .compareTo(
                                policy.money(
                                        settlementCase.sourceReleasedAmount()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Recorded release amount changed after settlement-case creation."
            );
        }
    }

    private void validateSettlementItemAuthority(
            List<FlywheelReleaseItemResponse> releaseItems,
            FlywheelSettlementRepository.ItemRow settlementItem
    ) {
        FlywheelReleaseItemResponse source =
                releaseItems
                        .stream()
                        .filter(
                                item ->
                                        item.id()
                                                .equals(
                                                        settlementItem.releaseItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Settlement evidence refers to a source release item that no longer exists."
                                        )
                        );

        if (
                source.status()
                        != FlywheelReleaseItemStatus.RELEASED
        ) {
            throw new IllegalArgumentException(
                    "Settlement evidence source is no longer RELEASED."
            );
        }

        if (
                !source
                        .allocationItemId()
                        .equals(
                                settlementItem.allocationItemId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Allocation authority changed after settlement evidence capture."
            );
        }

        if (
                !source
                        .flywheelLineageId()
                        .equals(
                                settlementItem.flywheelLineageId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Flywheel lineage authority changed after settlement evidence capture."
            );
        }

        if (
                policy
                        .money(
                                source.plannedReleaseAmount()
                        )
                        .compareTo(
                                policy.money(
                                        settlementItem.sourceReleasedAmount()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Source release amount changed after settlement evidence capture."
            );
        }
    }

    private FlywheelSettlementCaseResponse caseResponse(
            FlywheelSettlementRepository.CaseRow row
    ) {
        List<FlywheelSettlementRepository.ItemRow> items =
                repository.items(
                        row.id()
                );

        FlywheelSettlementMetricResult metric =
                policy.metrics(
                        row.sourceReleasedAmount(),

                        items
                                .stream()
                                .map(
                                        FlywheelSettlementRepository.ItemRow::
                                                settledAmount
                                )
                                .toList()
                );

        return new FlywheelSettlementCaseResponse(
                row.id(),
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
                        row.sourceReleasedAmount()
                ),

                metric.settledAmount(),
                metric.varianceAmount(),
                metric.settlementPct(),

                items.size(),

                countItemStatus(
                        items,
                        FlywheelSettlementItemStatus.SETTLED
                ),

                countItemStatus(
                        items,
                        FlywheelSettlementItemStatus.PARTIAL
                ),

                countItemStatus(
                        items,
                        FlywheelSettlementItemStatus.UNRESOLVED
                ),

                row.reconciliationOwnerUserId(),
                row.reconciliationOwnerName(),

                row.reconciliationRationale(),

                row.status(),

                row.submittedByName(),
                row.submittedAt(),

                row.reconciliationNote(),
                row.reconciledByName(),
                row.reconciledAt(),

                row.closeNote(),
                row.closedByName(),
                row.closedAt(),

                row.createdAt(),
                row.updatedAt(),

                row.version()
        );
    }

    private FlywheelSettlementItemResponse itemResponse(
            FlywheelSettlementRepository.ItemRow row
    ) {
        return new FlywheelSettlementItemResponse(
                row.id(),
                row.settlementCaseId(),

                row.releaseItemId(),
                row.allocationItemId(),

                row.flywheelLineageId(),
                row.lineageNumber(),

                row.rootTargetInitiativeTitle(),

                policy.money(
                        row.sourceReleasedAmount()
                ),

                policy.money(
                        row.settledAmount()
                ),

                policy.money(
                        row.varianceAmount()
                ),

                row.reconciliationStatus(),

                row.evidenceReference(),
                row.evidenceDate(),
                row.evidenceNote(),

                row.addedByName(),
                row.addedAt()
        );
    }

    private FlywheelSettlementSummaryResponse summary(
            int eligibleReleaseCount,
            List<FlywheelSettlementCaseResponse> cases
    ) {
        List<FlywheelSettlementCaseResponse> finalized =
                cases
                        .stream()
                        .filter(
                                settlementCase ->
                                        settlementCase.status()
                                                == FlywheelSettlementCaseStatus.RECONCILED
                                        ||
                                        settlementCase.status()
                                                == FlywheelSettlementCaseStatus.CLOSED
                        )
                        .toList();

        return new FlywheelSettlementSummaryResponse(
                eligibleReleaseCount,

                cases.size(),

                countCaseStatus(
                        cases,
                        FlywheelSettlementCaseStatus.DRAFT
                ),

                countCaseStatus(
                        cases,
                        FlywheelSettlementCaseStatus.IN_REVIEW
                ),

                countCaseStatus(
                        cases,
                        FlywheelSettlementCaseStatus.RECONCILED
                ),

                countCaseStatus(
                        cases,
                        FlywheelSettlementCaseStatus.CLOSED
                ),

                CurrencyTotals.sum(
                        finalized,
                        FlywheelSettlementCaseResponse::currency,
                        FlywheelSettlementCaseResponse::settledAmount
                ),

                CurrencyTotals.sum(
                        finalized,
                        FlywheelSettlementCaseResponse::currency,
                        FlywheelSettlementCaseResponse::varianceAmount
                )
        );
    }

    private int countCaseStatus(
            List<FlywheelSettlementCaseResponse> cases,
            FlywheelSettlementCaseStatus status
    ) {
        return (int)
                cases
                        .stream()
                        .filter(
                                settlementCase ->
                                        settlementCase.status()
                                                == status
                        )
                        .count();
    }

    private int countItemStatus(
            List<FlywheelSettlementRepository.ItemRow> items,
            FlywheelSettlementItemStatus status
    ) {
        return (int)
                items
                        .stream()
                        .filter(
                                item ->
                                        item.reconciliationStatus()
                                                == status
                        )
                        .count();
    }

    private FlywheelSettlementSnapshotSummaryResponse snapshotSummary(
            FlywheelSettlementRepository.SnapshotRow row
    ) {
        return new FlywheelSettlementSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),

                row.settlementCaseId(),
                row.reconciliationNumber(),

                row.releaseBatchId(),
                row.releaseNumber(),

                row.caseStatus(),

                row.currency(),
                row.fiscalYear(),

                policy.money(
                        row.sourceReleasedAmount()
                ),

                policy.money(
                        row.settledAmount()
                ),

                policy.money(
                        row.varianceAmount()
                ),

                row.settlementPct(),

                row.itemCount(),
                row.settledCount(),
                row.partialCount(),
                row.unresolvedCount(),

                row.capturedByName(),
                row.capturedAt()
        );
    }

    private FlywheelSettlementSnapshotItemResponse snapshotItemResponse(
            FlywheelSettlementRepository.SnapshotItemRow row
    ) {
        return new FlywheelSettlementSnapshotItemResponse(
                row.releaseItemId(),

                row.flywheelLineageId(),
                row.lineageNumber(),

                row.rootTargetInitiativeTitle(),

                policy.money(
                        row.sourceReleasedAmount()
                ),

                policy.money(
                        row.settledAmount()
                ),

                policy.money(
                        row.varianceAmount()
                ),

                row.reconciliationStatus(),

                row.evidenceReference(),
                row.evidenceDate(),
                row.evidenceNote()
        );
    }


    private FlywheelSettlementRepository.CaseRow requireLockedCase(
            UUID caseId
    ) {
        FlywheelSettlementRepository.CaseRow observed =
                requireCase(
                        caseId
                );

        repository.lockReleaseBatch(
                observed.releaseBatchId()
        );

        repository.lockCase(
                caseId
        );

        FlywheelSettlementRepository.CaseRow current =
                requireCase(
                        caseId
                );

        if (
                !current
                        .releaseBatchId()
                        .equals(
                                observed.releaseBatchId()
                        )
        ) {
            throw new IllegalStateException(
                    "Settlement case source release changed while acquiring the governance lock."
            );
        }

        return current;
    }

    private FlywheelSettlementRepository.CaseRow requireCase(
            UUID caseId
    ) {
        FlywheelSettlementRepository.CaseRow settlementCase =
                repository.findCase(
                        caseId
                );

        if (
                settlementCase == null
        ) {
            throw new ResourceNotFoundException(
                    "Flywheel settlement reconciliation case not found: "
                            + caseId
            );
        }

        return settlementCase;
    }

    private AppUserEntity requireSettlementOwner(
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
                    "Requester accounts cannot own settlement reconciliation cases."
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
                "FWSET-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                ).getValue(),
                repository.nextCaseSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "FWSETSNAP-%d-%05d",
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
                    "Your ProcureIQ role cannot access settlement reconciliation."
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
                    "Your ProcureIQ role cannot prepare settlement reconciliation evidence."
            );
        }
    }

    private void assertFinalizeRole(
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
                    "Only administrators and procurement managers can finalize settlement reconciliation."
            );
        }
    }
}
