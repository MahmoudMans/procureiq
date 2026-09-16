package com.procureiq.flywheelrelease;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.flywheelallocation.FlywheelAllocationDashboardResponse;
import com.procureiq.flywheelallocation.FlywheelAllocationItemResponse;
import com.procureiq.flywheelallocation.FlywheelAllocationMandateDetailResponse;
import com.procureiq.flywheelallocation.FlywheelAllocationMandateResponse;
import com.procureiq.flywheelallocation.FlywheelAllocationMandateStatus;
import com.procureiq.flywheelallocation.FlywheelAllocationService;
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
@Transactional
public class FlywheelReleaseService {

    private final FlywheelReleaseRepository repository;

    private final FlywheelReleaseMathService mathService;

    private final FlywheelAllocationService allocationService;

    private final AppUserRepository appUserRepository;

    public FlywheelReleaseService(
            FlywheelReleaseRepository repository,
            FlywheelReleaseMathService mathService,
            FlywheelAllocationService allocationService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.allocationService =
                allocationService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public FlywheelReleaseDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        List<FlywheelReleaseMandateAuthorityResponse> mandates =
                eligibleMandates(
                        currentUserId
                );

        List<FlywheelReleaseBatchResponse> batches =
                repository
                        .batches()
                        .stream()
                        .map(
                                this::batchResponse
                        )
                        .toList();

        return new FlywheelReleaseDashboardResponse(
                summary(
                        mandates.size(),
                        batches
                ),

                repository.users(),

                mandates,

                batches,

                repository
                        .snapshots()
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public FlywheelReleaseBatchDetailResponse createBatch(
            UUID currentUserId,
            FlywheelReleaseBatchInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelAllocationMandateDetailResponse allocationDetail =
                requireAuthorizedMandate(
                        currentUserId,
                        input.allocationMandateId()
                );

        if (
                repository.hasOpenBatchForMandate(
                        input.allocationMandateId()
                )
        ) {
            throw new IllegalArgumentException(
                    "The authorized Step 68 mandate already has an open release batch."
            );
        }

        FlywheelReleaseMandateAuthorityResponse mandate =
                mandateAuthority(
                        allocationDetail.mandate()
                );

        if (
                mandate.remainingReleaseAuthorityAmount()
                        .compareTo(
                                BigDecimal.ZERO
                        ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "The Step 68 mandate has no remaining release authority."
            );
        }

        AppUserEntity owner =
                requireReleaseOwner(
                        input.releaseOwnerUserId()
                );

        UUID batchId =
                UUID.randomUUID();

        repository.createBatch(
                batchId,
                nextBatchNumber(),
                input,
                mandate,
                owner.getFullName(),
                currentUserId
        );

        return batch(
                currentUserId,
                batchId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelReleaseBatchDetailResponse batch(
            UUID currentUserId,
            UUID batchId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelReleaseRepository.BatchRow batch =
                requireBatch(
                        batchId
                );

        FlywheelAllocationMandateDetailResponse allocationDetail =
                allocationService.mandate(
                        currentUserId,
                        batch.allocationMandateId()
                );

        List<FlywheelReleaseRepository.ItemRow> currentItems =
                repository.items(
                        batchId
                );

        List<FlywheelReleaseCandidateItemResponse> candidates =
                allocationDetail
                        .items()
                        .stream()
                        .map(
                                this::candidateItem
                        )
                        .filter(
                                candidate ->
                                        candidate
                                                .remainingReleaseAuthorityAmount()
                                                .compareTo(
                                                        BigDecimal.ZERO
                                                ) > 0
                        )
                        .filter(
                                candidate ->
                                        currentItems
                                                .stream()
                                                .noneMatch(
                                                        existing ->
                                                                existing
                                                                        .allocationItemId()
                                                                        .equals(
                                                                                candidate.allocationItemId()
                                                                        )
                                                )
                        )
                        .toList();

        return new FlywheelReleaseBatchDetailResponse(
                batchResponse(
                        batch
                ),

                mandateAuthority(
                        allocationDetail.mandate()
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
                        .snapshotsForBatch(
                                batchId
                        )
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public FlywheelReleaseBatchDetailResponse addItem(
            UUID currentUserId,
            UUID batchId,
            FlywheelReleaseItemInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelReleaseRepository.BatchRow batch =
                requireBatch(
                        batchId
                );

        if (
                batch.status()
                        != FlywheelReleaseBatchStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Release items can be added only while the batch is DRAFT."
            );
        }

        FlywheelAllocationMandateDetailResponse allocationDetail =
                requireAuthorizedMandate(
                        currentUserId,
                        batch.allocationMandateId()
                );

        FlywheelAllocationItemResponse source =
                allocationDetail
                        .items()
                        .stream()
                        .filter(
                                item ->
                                        item.id()
                                                .equals(
                                                        input.allocationItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Step 68 allocation item does not belong to the source mandate."
                                        )
                        );

        if (
                repository
                        .items(
                                batchId
                        )
                        .stream()
                        .anyMatch(
                                item ->
                                        item.allocationItemId()
                                                .equals(
                                                        source.id()
                                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 68 allocation item already belongs to this release batch."
            );
        }

        BigDecimal planned =
                mathService.money(
                        input.plannedReleaseAmount()
                );

        if (
                planned.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            throw new IllegalArgumentException(
                    "Planned release amount must be positive."
            );
        }

        FlywheelReleaseCandidateItemResponse candidate =
                candidateItem(
                        source
                );

        if (
                planned.compareTo(
                        candidate.remainingReleaseAuthorityAmount()
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Planned release exceeds remaining Step 68 authority for this allocation item."
            );
        }

        BigDecimal existingActivePlanned =
                repository
                        .items(
                                batchId
                        )
                        .stream()
                        .filter(
                                item ->
                                        item.status()
                                                != FlywheelReleaseItemStatus.CANCELLED
                        )
                        .map(
                                FlywheelReleaseRepository.ItemRow::
                                        plannedReleaseAmount
                        )
                        .map(
                                mathService::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal cumulativeReleased =
                mathService.money(
                        repository
                                .cumulativeReleasedForMandate(
                                        batch.allocationMandateId()
                                )
                );

        BigDecimal resultingAuthorityUsage =
                cumulativeReleased
                        .add(
                                existingActivePlanned
                        )
                        .add(
                                planned
                        );

        if (
                resultingAuthorityUsage.compareTo(
                        mathService.money(
                                batch.mandateAuthorizedAmount()
                        )
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Planned release would exceed remaining Step 68 mandate authority."
            );
        }

        repository.createItem(
                UUID.randomUUID(),
                batchId,
                candidate,
                planned,
                currentUserId
        );

        return batch(
                currentUserId,
                batchId
        );
    }

    public FlywheelReleaseBatchDetailResponse submitForExecution(
            UUID currentUserId,
            UUID batchId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelReleaseRepository.BatchRow batch =
                requireBatch(
                        batchId
                );

        if (
                batch.status()
                        != FlywheelReleaseBatchStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only a DRAFT release batch can enter execution."
            );
        }

        List<FlywheelReleaseRepository.ItemRow> items =
                repository.items(
                        batchId
                );

        if (items.isEmpty()) {
            throw new IllegalArgumentException(
                    "Release batch requires at least one allocation item."
            );
        }

        if (
                items.stream()
                        .noneMatch(
                                item ->
                                        item.status()
                                                == FlywheelReleaseItemStatus.PENDING
                        )
        ) {
            throw new IllegalArgumentException(
                    "Release batch contains no pending execution item."
            );
        }

        validateMandateAuthority(
                currentUserId,
                batch,
                items
        );

        BigDecimal activePlanned =
                items.stream()
                        .filter(
                                item ->
                                        item.status()
                                                != FlywheelReleaseItemStatus.CANCELLED
                        )
                        .map(
                                FlywheelReleaseRepository.ItemRow::
                                        plannedReleaseAmount
                        )
                        .map(
                                mathService::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal cumulativeReleased =
                mathService.money(
                        repository
                                .cumulativeReleasedForMandate(
                                        batch.allocationMandateId()
                                )
                );

        if (
                cumulativeReleased
                        .add(
                                activePlanned
                        )
                        .compareTo(
                                mathService.money(
                                        batch.mandateAuthorizedAmount()
                                )
                        ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Release batch would exceed cumulative Step 68 mandate authority."
            );
        }

        int updated =
                repository.submitForExecution(
                        batchId,
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Release batch state changed before execution submission."
            );
        }

        return batch(
                currentUserId,
                batchId
        );
    }

    public FlywheelReleaseBatchDetailResponse releaseItem(
            UUID currentUserId,
            UUID itemId,
            FlywheelReleaseExecutionInput input
    ) {
        assertExecuteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelReleaseRepository.ItemRow item =
                requireItem(
                        itemId
                );

        FlywheelReleaseRepository.BatchRow batch =
                requireBatch(
                        item.releaseBatchId()
                );

        if (
                batch.status()
                        != FlywheelReleaseBatchStatus.IN_EXECUTION
        ) {
            throw new IllegalArgumentException(
                    "Release items can be executed only while the batch is IN_EXECUTION."
            );
        }

        if (
                item.status()
                        != FlywheelReleaseItemStatus.PENDING
        ) {
            throw new IllegalArgumentException(
                    "Release item already has a final execution state."
            );
        }

        validateSingleItemAuthority(
                currentUserId,
                batch,
                item
        );

        BigDecimal previouslyReleasedForItem =
                mathService.money(
                        repository
                                .cumulativeReleasedForAllocationItem(
                                        item.allocationItemId()
                                )
                );

        if (
                previouslyReleasedForItem
                        .add(
                                mathService.money(
                                        item.plannedReleaseAmount()
                                )
                        )
                        .compareTo(
                                mathService.money(
                                        item.mandateAuthorizedItemAmount()
                                )
                        ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Executing this item would exceed its Step 68 authorized allocation amount."
            );
        }

        BigDecimal cumulativeMandateReleased =
                mathService.money(
                        repository
                                .cumulativeReleasedForMandate(
                                        batch.allocationMandateId()
                                )
                );

        if (
                cumulativeMandateReleased
                        .add(
                                mathService.money(
                                        item.plannedReleaseAmount()
                                )
                        )
                        .compareTo(
                                mathService.money(
                                        batch.mandateAuthorizedAmount()
                                )
                        ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Executing this item would exceed cumulative Step 68 mandate authority."
            );
        }

        int updated =
                repository.releaseItem(
                        itemId,
                        input,
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Release item state changed before execution persistence."
            );
        }

        return batch(
                currentUserId,
                batch.id()
        );
    }

    public FlywheelReleaseBatchDetailResponse cancelItem(
            UUID currentUserId,
            UUID itemId,
            FlywheelReleaseNoteInput input
    ) {
        assertExecuteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelReleaseRepository.ItemRow item =
                requireItem(
                        itemId
                );

        FlywheelReleaseRepository.BatchRow batch =
                requireBatch(
                        item.releaseBatchId()
                );

        if (
                batch.status()
                        != FlywheelReleaseBatchStatus.IN_EXECUTION
        ) {
            throw new IllegalArgumentException(
                    "Release items can be cancelled only while the batch is IN_EXECUTION."
            );
        }

        if (
                item.status()
                        != FlywheelReleaseItemStatus.PENDING
        ) {
            throw new IllegalArgumentException(
                    "Only a PENDING release item may be cancelled."
            );
        }

        int updated =
                repository.cancelItem(
                        itemId,
                        input.note(),
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Release item state changed before cancellation."
            );
        }

        return batch(
                currentUserId,
                batch.id()
        );
    }

    public FlywheelReleaseBatchDetailResponse markExecuted(
            UUID currentUserId,
            UUID batchId,
            FlywheelReleaseNoteInput input
    ) {
        assertExecuteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelReleaseRepository.BatchRow batch =
                requireBatch(
                        batchId
                );

        if (
                batch.status()
                        != FlywheelReleaseBatchStatus.IN_EXECUTION
        ) {
            throw new IllegalArgumentException(
                    "Only an IN_EXECUTION release batch can be finalized."
            );
        }

        List<FlywheelReleaseRepository.ItemRow> items =
                repository.items(
                        batchId
                );

        if (
                items.stream()
                        .anyMatch(
                                item ->
                                        item.status()
                                                == FlywheelReleaseItemStatus.PENDING
                        )
        ) {
            throw new IllegalArgumentException(
                    "Every release item must be RELEASED or CANCELLED before batch finalization."
            );
        }

        if (
                items.stream()
                        .noneMatch(
                                item ->
                                        item.status()
                                                == FlywheelReleaseItemStatus.RELEASED
                        )
        ) {
            throw new IllegalArgumentException(
                    "Release batch requires at least one RELEASED item before finalization."
            );
        }

        validateMandateAuthority(
                currentUserId,
                batch,
                items
        );

        int updated =
                repository.markExecuted(
                        batchId,
                        input.note(),
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Release batch state changed before finalization."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                batchId
        );

        return batch(
                currentUserId,
                batchId
        );
    }

    public FlywheelReleaseBatchDetailResponse close(
            UUID currentUserId,
            UUID batchId,
            FlywheelReleaseNoteInput input
    ) {
        assertExecuteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelReleaseRepository.BatchRow batch =
                requireBatch(
                        batchId
                );

        if (
                batch.status()
                        != FlywheelReleaseBatchStatus.EXECUTED
        ) {
            throw new IllegalArgumentException(
                    "Only an EXECUTED release batch can be closed."
            );
        }

        int updated =
                repository.close(
                        batchId,
                        input.note(),
                        currentUserId
                );

        if (updated != 1) {
            throw new IllegalArgumentException(
                    "Release batch state changed before closure."
            );
        }

        captureSnapshotInternal(
                currentUserId,
                batchId
        );

        return batch(
                currentUserId,
                batchId
        );
    }

    public FlywheelReleaseSnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            UUID batchId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        requireBatch(
                batchId
        );

        return captureSnapshotInternal(
                currentUserId,
                batchId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelReleaseSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                ).getRole()
        );

        FlywheelReleaseRepository.SnapshotRow snapshot =
                repository.findSnapshot(
                        snapshotId
                );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Flywheel release snapshot not found: "
                            + snapshotId
            );
        }

        return new FlywheelReleaseSnapshotDetailResponse(
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

    private FlywheelReleaseSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId,
            UUID batchId
    ) {
        FlywheelReleaseRepository.BatchRow batch =
                requireBatch(
                        batchId
                );

        FlywheelReleaseBatchResponse response =
                batchResponse(
                        batch
                );

        List<FlywheelReleaseItemResponse> items =
                repository
                        .items(
                                batchId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                response,
                currentUserId
        );

        for (
                FlywheelReleaseItemResponse item
                : items
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

    private List<FlywheelReleaseMandateAuthorityResponse> eligibleMandates(
            UUID currentUserId
    ) {
        FlywheelAllocationDashboardResponse dashboard =
                allocationService.dashboard(
                        currentUserId
                );

        return dashboard
                .mandates()
                .stream()
                .filter(
                        mandate ->
                                mandate.status()
                                        == FlywheelAllocationMandateStatus.AUTHORIZED
                )
                .map(
                        this::mandateAuthority
                )
                .filter(
                        mandate ->
                                mandate
                                        .remainingReleaseAuthorityAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        ) > 0
                )
                .filter(
                        mandate ->
                                !repository.hasOpenBatchForMandate(
                                        mandate.allocationMandateId()
                                )
                )
                .toList();
    }

    private FlywheelAllocationMandateDetailResponse requireAuthorizedMandate(
            UUID currentUserId,
            UUID mandateId
    ) {
        FlywheelAllocationMandateDetailResponse detail =
                allocationService.mandate(
                        currentUserId,
                        mandateId
                );

        if (
                detail
                        .mandate()
                        .status()
                        != FlywheelAllocationMandateStatus.AUTHORIZED
        ) {
            throw new IllegalArgumentException(
                    "Step 69 requires an AUTHORIZED Step 68 allocation mandate."
            );
        }

        return detail;
    }

    private FlywheelReleaseMandateAuthorityResponse mandateAuthority(
            FlywheelAllocationMandateResponse mandate
    ) {
        BigDecimal authorized =
                mathService.money(
                        mandate.requestedAllocationAmount()
                );

        BigDecimal released =
                mathService.money(
                        repository
                                .cumulativeReleasedForMandate(
                                        mandate.id()
                                )
                );

        BigDecimal remaining =
                authorized
                        .subtract(
                                released
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .setScale(
                                2
                        );

        return new FlywheelReleaseMandateAuthorityResponse(
                mandate.id(),
                mandate.mandateNumber(),

                mandate.strategyPortfolioId(),
                mandate.strategyPortfolioNumber(),

                mandate.title(),

                mandate.currency(),
                mandate.fiscalYear(),

                authorized,
                released,
                remaining,

                mandate.itemCount(),

                mandate.mandateOwnerName(),
                mandate.mandateRationale(),

                mandate.status()
        );
    }

    private FlywheelReleaseCandidateItemResponse candidateItem(
            FlywheelAllocationItemResponse item
    ) {
        BigDecimal authorized =
                mathService.money(
                        item.requestedAllocationAmount()
                );

        BigDecimal released =
                mathService.money(
                        repository
                                .cumulativeReleasedForAllocationItem(
                                        item.id()
                                )
                );

        BigDecimal remaining =
                authorized
                        .subtract(
                                released
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .setScale(
                                2
                        );

        return new FlywheelReleaseCandidateItemResponse(
                item.id(),
                item.strategyItemId(),

                item.flywheelLineageId(),
                item.lineageNumber(),

                item.rootTargetInitiativeTitle(),

                authorized,
                released,
                remaining,

                mathService.percent(
                        item.strategyPriorityScore()
                )
        );
    }

    private void validateMandateAuthority(
            UUID currentUserId,
            FlywheelReleaseRepository.BatchRow batch,
            List<FlywheelReleaseRepository.ItemRow> releaseItems
    ) {
        FlywheelAllocationMandateDetailResponse allocation =
                requireAuthorizedMandate(
                        currentUserId,
                        batch.allocationMandateId()
                );

        FlywheelAllocationMandateResponse mandate =
                allocation.mandate();

        if (
                !mandate
                        .mandateNumber()
                        .equals(
                                batch.allocationMandateNumber()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 68 mandate identity changed after release-batch creation."
            );
        }

        if (
                !mandate
                        .strategyPortfolioId()
                        .equals(
                                batch.strategyPortfolioId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 68 strategy authority changed after release-batch creation."
            );
        }

        if (
                !mandate
                        .currency()
                        .equalsIgnoreCase(
                                batch.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 68 mandate currency no longer matches the release batch."
            );
        }

        if (
                mathService
                        .money(
                                mandate.requestedAllocationAmount()
                        )
                        .compareTo(
                                mathService.money(
                                        batch.mandateAuthorizedAmount()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 68 authorized mandate amount changed after release-batch creation."
            );
        }

        for (
                FlywheelReleaseRepository.ItemRow releaseItem
                : releaseItems
        ) {
            validateItemAgainstAllocation(
                    allocation,
                    releaseItem
            );
        }
    }

    private void validateSingleItemAuthority(
            UUID currentUserId,
            FlywheelReleaseRepository.BatchRow batch,
            FlywheelReleaseRepository.ItemRow releaseItem
    ) {
        FlywheelAllocationMandateDetailResponse allocation =
                requireAuthorizedMandate(
                        currentUserId,
                        batch.allocationMandateId()
                );

        validateItemAgainstAllocation(
                allocation,
                releaseItem
        );
    }

    private void validateItemAgainstAllocation(
            FlywheelAllocationMandateDetailResponse allocation,
            FlywheelReleaseRepository.ItemRow releaseItem
    ) {
        FlywheelAllocationItemResponse source =
                allocation
                        .items()
                        .stream()
                        .filter(
                                item ->
                                        item.id()
                                                .equals(
                                                        releaseItem.allocationItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Step 68 allocation item no longer exists."
                                        )
                        );

        if (
                !source
                        .strategyItemId()
                        .equals(
                                releaseItem.strategyItemId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 68 strategy-item lineage changed after release capture."
            );
        }

        if (
                !source
                        .flywheelLineageId()
                        .equals(
                                releaseItem.flywheelLineageId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 68 flywheel lineage changed after release capture."
            );
        }

        if (
                mathService
                        .money(
                                source.requestedAllocationAmount()
                        )
                        .compareTo(
                                mathService.money(
                                        releaseItem.mandateAuthorizedItemAmount()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 68 authorized allocation-item amount changed after release capture."
            );
        }

        if (
                mathService
                        .percent(
                                source.strategyPriorityScore()
                        )
                        .compareTo(
                                mathService.percent(
                                        releaseItem.strategyPriorityScore()
                                )
                        ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 68 strategy priority changed after release capture."
            );
        }

        if (
                mathService
                        .money(
                                releaseItem.plannedReleaseAmount()
                        )
                        .compareTo(
                                mathService.money(
                                        source.requestedAllocationAmount()
                                )
                        ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Release item exceeds its current Step 68 allocation authority."
            );
        }
    }

    private FlywheelReleaseBatchResponse batchResponse(
            FlywheelReleaseRepository.BatchRow row
    ) {
        List<FlywheelReleaseRepository.ItemRow> items =
                repository.items(
                        row.id()
                );

        BigDecimal cumulativeReleased =
                mathService.money(
                        repository
                                .cumulativeReleasedForMandate(
                                        row.allocationMandateId()
                                )
                );

        FlywheelReleaseMetricResult metric =
                mathService.calculate(
                        row.mandateAuthorizedAmount(),

                        items.stream()
                                .filter(
                                        item ->
                                                item.status()
                                                        != FlywheelReleaseItemStatus.CANCELLED
                                )
                                .map(
                                        FlywheelReleaseRepository.ItemRow::
                                                plannedReleaseAmount
                                )
                                .toList(),

                        items.stream()
                                .filter(
                                        item ->
                                                item.status()
                                                        == FlywheelReleaseItemStatus.RELEASED
                                )
                                .map(
                                        FlywheelReleaseRepository.ItemRow::
                                                plannedReleaseAmount
                                )
                                .toList(),

                        cumulativeReleased
                );

        return new FlywheelReleaseBatchResponse(
                row.id(),
                row.releaseNumber(),

                row.allocationMandateId(),
                row.allocationMandateNumber(),

                row.strategyPortfolioId(),
                row.strategyPortfolioNumber(),

                row.title(),

                row.currency(),
                row.fiscalYear(),

                mathService.money(
                        row.mandateAuthorizedAmount()
                ),

                metric.batchPlannedReleaseAmount(),
                metric.batchReleasedAmount(),

                metric.cumulativeMandateReleasedAmount(),
                metric.remainingMandateAmount(),
                metric.cumulativeReleaseUtilizationPct(),

                items.size(),

                countItemStatus(
                        items,
                        FlywheelReleaseItemStatus.PENDING
                ),

                countItemStatus(
                        items,
                        FlywheelReleaseItemStatus.RELEASED
                ),

                countItemStatus(
                        items,
                        FlywheelReleaseItemStatus.CANCELLED
                ),

                row.releaseOwnerUserId(),
                row.releaseOwnerName(),

                row.releaseRationale(),

                row.status(),

                row.submittedByName(),
                row.submittedAt(),

                row.executionNote(),
                row.executedByName(),
                row.executedAt(),

                row.closeNote(),
                row.closedByName(),
                row.closedAt(),

                row.createdAt(),
                row.updatedAt(),

                row.version()
        );
    }

    private FlywheelReleaseItemResponse itemResponse(
            FlywheelReleaseRepository.ItemRow row
    ) {
        return new FlywheelReleaseItemResponse(
                row.id(),
                row.releaseBatchId(),

                row.allocationItemId(),
                row.strategyItemId(),

                row.flywheelLineageId(),
                row.lineageNumber(),

                row.rootTargetInitiativeTitle(),

                mathService.money(
                        row.mandateAuthorizedItemAmount()
                ),

                mathService.percent(
                        row.strategyPriorityScore()
                ),

                mathService.money(
                        row.plannedReleaseAmount()
                ),

                row.status(),

                row.executionReference(),
                row.executionNote(),

                row.releasedByName(),
                row.releasedAt(),

                row.cancellationNote(),
                row.cancelledByName(),
                row.cancelledAt(),

                row.addedByName(),
                row.addedAt()
        );
    }

    private FlywheelReleaseSummaryResponse summary(
            int eligibleMandateCount,
            List<FlywheelReleaseBatchResponse> batches
    ) {
        BigDecimal cumulativeReleased =
                batches.stream()
                        .map(
                                FlywheelReleaseBatchResponse::
                                        batchReleasedAmount
                        )
                        .map(
                                mathService::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2
                        );

        return new FlywheelReleaseSummaryResponse(
                eligibleMandateCount,

                batches.size(),

                countBatchStatus(
                        batches,
                        FlywheelReleaseBatchStatus.DRAFT
                ),

                countBatchStatus(
                        batches,
                        FlywheelReleaseBatchStatus.IN_EXECUTION
                ),

                countBatchStatus(
                        batches,
                        FlywheelReleaseBatchStatus.EXECUTED
                ),

                countBatchStatus(
                        batches,
                        FlywheelReleaseBatchStatus.CLOSED
                ),

                cumulativeReleased
        );
    }

    private int countBatchStatus(
            List<FlywheelReleaseBatchResponse> batches,
            FlywheelReleaseBatchStatus status
    ) {
        return (int)
                batches.stream()
                        .filter(
                                batch ->
                                        batch.status()
                                                == status
                        )
                        .count();
    }

    private int countItemStatus(
            List<FlywheelReleaseRepository.ItemRow> items,
            FlywheelReleaseItemStatus status
    ) {
        return (int)
                items.stream()
                        .filter(
                                item ->
                                        item.status()
                                                == status
                        )
                        .count();
    }

    private FlywheelReleaseSnapshotSummaryResponse snapshotSummary(
            FlywheelReleaseRepository.SnapshotRow row
    ) {
        return new FlywheelReleaseSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),

                row.releaseBatchId(),
                row.releaseNumber(),

                row.allocationMandateId(),
                row.allocationMandateNumber(),

                row.releaseStatus(),

                row.currency(),
                row.fiscalYear(),

                mathService.money(
                        row.mandateAuthorizedAmount()
                ),

                mathService.money(
                        row.batchPlannedReleaseAmount()
                ),

                mathService.money(
                        row.batchReleasedAmount()
                ),

                mathService.money(
                        row.cumulativeMandateReleasedAmount()
                ),

                mathService.money(
                        row.remainingMandateAmount()
                ),

                mathService.percent(
                        row.cumulativeReleaseUtilizationPct()
                ),

                row.itemCount(),
                row.pendingCount(),
                row.releasedCount(),
                row.cancelledCount(),

                row.capturedByName(),
                row.capturedAt()
        );
    }

    private FlywheelReleaseSnapshotItemResponse snapshotItemResponse(
            FlywheelReleaseRepository.SnapshotItemRow row
    ) {
        return new FlywheelReleaseSnapshotItemResponse(
                row.allocationItemId(),

                row.flywheelLineageId(),
                row.lineageNumber(),

                row.rootTargetInitiativeTitle(),

                mathService.money(
                        row.mandateAuthorizedItemAmount()
                ),

                mathService.money(
                        row.plannedReleaseAmount()
                ),

                row.releaseItemStatus(),

                row.executionReference(),
                row.executionNote(),
                row.cancellationNote()
        );
    }

    private FlywheelReleaseRepository.BatchRow requireBatch(
            UUID batchId
    ) {
        FlywheelReleaseRepository.BatchRow batch =
                repository.findBatch(
                        batchId
                );

        if (batch == null) {
            throw new ResourceNotFoundException(
                    "Flywheel release batch not found: "
                            + batchId
            );
        }

        return batch;
    }

    private FlywheelReleaseRepository.ItemRow requireItem(
            UUID itemId
    ) {
        FlywheelReleaseRepository.ItemRow item =
                repository.findItem(
                        itemId
                );

        if (item == null) {
            throw new ResourceNotFoundException(
                    "Flywheel release item not found: "
                            + itemId
            );
        }

        return item;
    }

    private AppUserEntity requireReleaseOwner(
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
                    "Requester accounts cannot own flywheel release batches."
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

    private String nextBatchNumber() {
        return String.format(
                "FWREL-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                ).getValue(),
                repository.nextBatchSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "FWRELSNAP-%d-%05d",
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
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
                &&
                role != ProcurementRole.APPROVER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot access flywheel release execution."
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
                    "Your ProcureIQ role cannot prepare flywheel release batches."
            );
        }
    }

    private void assertExecuteRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can execute flywheel releases."
            );
        }
    }
}
