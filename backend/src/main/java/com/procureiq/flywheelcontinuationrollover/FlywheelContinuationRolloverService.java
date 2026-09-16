package com.procureiq.flywheelcontinuationrollover;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FlywheelContinuationRolloverService {

    private static final Set<String> MANAGER_ROLES =
            Set.of(
                    "ADMIN",
                    "PROCUREMENT_MANAGER"
            );

    private final FlywheelContinuationRolloverRepository repository;

    private final FlywheelContinuationRolloverPolicyService policy;

    public FlywheelContinuationRolloverService(
            FlywheelContinuationRolloverRepository repository,
            FlywheelContinuationRolloverPolicyService policy
    ) {
        this.repository = repository;
        this.policy = policy;
    }


    @Transactional(readOnly = true)
    public FlywheelContinuationRolloverDashboardResponse dashboard(
            UUID userId
    ) {
        actor(
                userId
        );

        List<FlywheelContinuationRolloverCaseResponse> cases =
                repository.cases();

        return new FlywheelContinuationRolloverDashboardResponse(
                summary(
                        cases
                ),
                cases,
                repository.eligibleSources()
        );
    }


    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationRolloverCaseDetailResponse createCase(
            UUID userId,
            FlywheelContinuationRolloverCaseInput input
    ) {
        FlywheelContinuationRolloverActor actor =
                actor(
                        userId
                );

        if (
                repository.existsForSource(
                        input.sourceContinuationOutcomeCaseId()
                )
        ) {
            throw new IllegalArgumentException(
                    "A rollover cycle already exists for this continuation outcome."
            );
        }


        FlywheelContinuationRolloverSourceResponse source =
                repository.source(
                        input.sourceContinuationOutcomeCaseId()
                );


        if (source == null) {
            throw new IllegalArgumentException(
                    "Only VERIFIED positive residual outcomes requiring further governance may roll over."
            );
        }


        policy.validateEligibleSource(
                "VERIFIED",
                "FURTHER_GOVERNANCE_REQUIRED",
                source.remainingResidualAmount(),
                source.positiveResidualItemCount()
        );


        UUID id =
                UUID.randomUUID();


        if (
                repository.createCase(
                        id,
                        repository.nextRolloverNumber(),
                        source,
                        actor
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation rollover case was not created."
            );
        }


        return rolloverCase(
                userId,
                id
        );
    }


    @Transactional(readOnly = true)
    public FlywheelContinuationRolloverCaseDetailResponse rolloverCase(
            UUID userId,
            UUID caseId
    ) {
        actor(
                userId
        );


        FlywheelContinuationRolloverCaseResponse rollover =
                requiredCase(
                        caseId
                );


        List<FlywheelContinuationRolloverItemResponse> items =
                repository.items(
                        caseId
                );


        List<FlywheelContinuationRolloverCandidateResponse> candidates =
                List.of();


        if (
                rollover.status()
                ==
                FlywheelContinuationRolloverStatus.DRAFT
        ) {
            Set<UUID> covered =
                    items.stream()
                            .map(
                                    FlywheelContinuationRolloverItemResponse
                                        ::sourceContinuationOutcomeItemId
                            )
                            .collect(
                                    Collectors.toSet()
                            );


            candidates =
                    repository.candidates(
                                    rollover.sourceContinuationOutcomeCaseId()
                            )
                            .stream()
                            .filter(
                                    candidate ->
                                            !covered.contains(
                                                    candidate.continuationOutcomeItemId()
                                            )
                            )
                            .toList();
        }


        return new FlywheelContinuationRolloverCaseDetailResponse(
                rollover,
                items,
                candidates,
                repository.snapshots(
                        caseId
                )
        );
    }


    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationRolloverCaseDetailResponse addItem(
            UUID userId,
            UUID caseId,
            FlywheelContinuationRolloverItemInput input
    ) {
        actor(
                userId
        );


        FlywheelContinuationRolloverCaseResponse rollover =
                requiredCase(
                        caseId
                );


        if (
                rollover.status()
                !=
                FlywheelContinuationRolloverStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Rollover governance can be added only while DRAFT."
            );
        }


        FlywheelContinuationRolloverCandidateResponse source =
                repository.candidates(
                                rollover.sourceContinuationOutcomeCaseId()
                        )
                        .stream()
                        .filter(
                                candidate ->
                                        candidate.continuationOutcomeItemId()
                                                .equals(
                                                        input.sourceContinuationOutcomeItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Source outcome item is not an eligible positive residual item."
                                        )
                        );


        boolean duplicate =
                repository.items(
                                caseId
                        )
                        .stream()
                        .anyMatch(
                                item ->
                                        item.sourceContinuationOutcomeItemId()
                                                .equals(
                                                        input.sourceContinuationOutcomeItemId()
                                                )
                        );


        if (duplicate) {
            throw new IllegalArgumentException(
                    "This positive residual item already has rollover governance."
            );
        }


        policy.validateItem(
                source.remainingResidualAmount(),
                input.targetDate(),
                input.rationale(),
                LocalDate.now()
        );


        FlywheelResidualContinuationAction continuationAction =
                policy.continuationAction(
                        source.sourceContinuationAction()
                );


        if (
                repository.createItem(
                        UUID.randomUUID(),
                        caseId,
                        source,
                        continuationAction,
                        input,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation rollover item was not created."
            );
        }


        return rolloverCase(
                userId,
                caseId
        );
    }


    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationRolloverCaseDetailResponse submit(
            UUID userId,
            UUID caseId
    ) {
        actor(
                userId
        );


        FlywheelContinuationRolloverCaseResponse rollover =
                requiredCase(
                        caseId
                );


        if (
                rollover.status()
                !=
                FlywheelContinuationRolloverStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only DRAFT rollover cases can be submitted."
            );
        }


        requireComplete(
                rollover
        );


        if (
                repository.submit(
                        caseId,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation rollover could not be submitted."
            );
        }


        return rolloverCase(
                userId,
                caseId
        );
    }


    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationRolloverCaseDetailResponse approve(
            UUID userId,
            UUID caseId,
            FlywheelContinuationRolloverNoteInput input
    ) {
        FlywheelContinuationRolloverActor actor =
                actor(
                        userId
                );


        requireManager(
                actor
        );


        FlywheelContinuationRolloverCaseResponse rollover =
                requiredCase(
                        caseId
                );


        if (
                rollover.status()
                !=
                FlywheelContinuationRolloverStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only IN_REVIEW rollover cases can be approved."
            );
        }


        requireComplete(
                rollover
        );


        if (
                repository.approve(
                        caseId,
                        userId,
                        input.note().trim()
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation rollover could not be approved."
            );
        }


        captureSnapshotInternal(
                userId,
                caseId
        );


        return rolloverCase(
                userId,
                caseId
        );
    }


    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationRolloverCaseDetailResponse close(
            UUID userId,
            UUID caseId,
            FlywheelContinuationRolloverNoteInput input
    ) {
        FlywheelContinuationRolloverActor actor =
                actor(
                        userId
                );


        requireManager(
                actor
        );


        FlywheelContinuationRolloverCaseResponse rollover =
                requiredCase(
                        caseId
                );


        if (
                rollover.status()
                !=
                FlywheelContinuationRolloverStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Only APPROVED rollover cases can be closed."
            );
        }


        requireComplete(
                rollover
        );


        if (
                repository.close(
                        caseId,
                        userId,
                        input.note().trim()
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation rollover could not be closed."
            );
        }


        captureSnapshotInternal(
                userId,
                caseId
        );


        return rolloverCase(
                userId,
                caseId
        );
    }


    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationRolloverSnapshotDetailResponse captureSnapshot(
            UUID userId,
            UUID caseId
    ) {
        actor(
                userId
        );


        return captureSnapshotInternal(
                userId,
                caseId
        );
    }


    @Transactional(readOnly = true)
    public FlywheelContinuationRolloverSnapshotDetailResponse snapshot(
            UUID userId,
            UUID snapshotId
    ) {
        actor(
                userId
        );


        FlywheelContinuationRolloverSnapshotSummaryResponse snapshot =
                repository.snapshot(
                        snapshotId
                );


        if (snapshot == null) {
            throw new IllegalArgumentException(
                    "Continuation rollover snapshot does not exist."
            );
        }


        return new FlywheelContinuationRolloverSnapshotDetailResponse(
                snapshot,
                repository.snapshotItems(
                        snapshotId
                )
        );
    }


    private FlywheelContinuationRolloverSnapshotDetailResponse captureSnapshotInternal(
            UUID userId,
            UUID caseId
    ) {
        FlywheelContinuationRolloverCaseResponse rollover =
                requiredCase(
                        caseId
                );


        requireComplete(
                rollover
        );


        List<FlywheelContinuationRolloverItemResponse> items =
                repository.items(
                        caseId
                );


        UUID snapshotId =
                UUID.randomUUID();


        if (
                repository.createSnapshot(
                        snapshotId,
                        repository.nextSnapshotNumber(),
                        rollover,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation rollover snapshot was not created."
            );
        }


        for (
                FlywheelContinuationRolloverItemResponse item
                : items
        ) {
            if (
                    repository.createSnapshotItem(
                            snapshotId,
                            item
                    )
                    != 1
            ) {
                throw new IllegalStateException(
                        "Continuation rollover snapshot item was not created."
                );
            }
        }


        if (
                repository.sealSnapshot(
                        snapshotId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation rollover snapshot was not sealed."
            );
        }


        return new FlywheelContinuationRolloverSnapshotDetailResponse(
                repository.snapshot(
                        snapshotId
                ),
                repository.snapshotItems(
                        snapshotId
                )
        );
    }


    private void requireComplete(
            FlywheelContinuationRolloverCaseResponse rollover
    ) {
        List<FlywheelContinuationRolloverItemResponse> items =
                repository.items(
                        rollover.id()
                );


        if (
                items.size()
                !=
                rollover.sourceResidualItemCount()
        ) {
            throw new IllegalArgumentException(
                    "Every positive residual outcome item requires rollover governance."
            );
        }


        BigDecimal governed =
                items.stream()
                        .map(
                                FlywheelContinuationRolloverItemResponse
                                    ::sourceRemainingResidualAmount
                        )
                        .reduce(
                                new BigDecimal(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );


        if (
                governed.compareTo(
                        rollover.sourceRemainingResidualAmount()
                )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Rollover governance does not reconcile to verified residual."
            );
        }
    }


    private FlywheelContinuationRolloverCaseResponse requiredCase(
            UUID id
    ) {
        FlywheelContinuationRolloverCaseResponse rollover =
                repository.findCase(
                        id
                );


        if (rollover == null) {
            throw new IllegalArgumentException(
                    "Continuation rollover case does not exist."
            );
        }


        return rollover;
    }


    private FlywheelContinuationRolloverActor actor(
            UUID id
    ) {
        FlywheelContinuationRolloverActor actor =
                repository.actor(
                        id
                );


        if (actor == null) {
            throw new IllegalArgumentException(
                    "User does not exist."
            );
        }


        if (!actor.active()) {
            throw new IllegalArgumentException(
                    "User is inactive."
            );
        }


        return actor;
    }


    private void requireManager(
            FlywheelContinuationRolloverActor actor
    ) {
        if (
                !MANAGER_ROLES.contains(
                        actor.role()
                )
        ) {
            throw new IllegalArgumentException(
                    "Procurement manager authority is required."
            );
        }
    }


    private FlywheelContinuationRolloverSummaryResponse summary(
            List<FlywheelContinuationRolloverCaseResponse> cases
    ) {
        Map<String, BigDecimal> totals =
                new LinkedHashMap<>();


        for (
                FlywheelContinuationRolloverCaseResponse rollover
                : cases
        ) {
            totals.merge(
                    rollover.currency(),
                    rollover.sourceRemainingResidualAmount(),
                    BigDecimal::add
            );
        }


        return new FlywheelContinuationRolloverSummaryResponse(
                cases.size(),

                cases.stream()
                        .filter(
                                item ->
                                        item.status()
                                        ==
                                        FlywheelContinuationRolloverStatus.DRAFT
                        )
                        .count(),

                cases.stream()
                        .filter(
                                item ->
                                        item.status()
                                        ==
                                        FlywheelContinuationRolloverStatus.IN_REVIEW
                        )
                        .count(),

                cases.stream()
                        .filter(
                                item ->
                                        item.status()
                                        ==
                                        FlywheelContinuationRolloverStatus.APPROVED
                        )
                        .count(),

                cases.stream()
                        .filter(
                                item ->
                                        item.status()
                                        ==
                                        FlywheelContinuationRolloverStatus.CLOSED
                        )
                        .count(),

                totals.entrySet()
                        .stream()
                        .map(
                                entry ->
                                        new FlywheelContinuationRolloverCurrencyTotal(
                                                entry.getKey(),
                                                entry.getValue()
                                        )
                        )
                        .toList()
        );
    }
}
