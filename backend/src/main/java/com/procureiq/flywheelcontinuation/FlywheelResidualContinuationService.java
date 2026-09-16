package com.procureiq.flywheelcontinuation;

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
public class FlywheelResidualContinuationService {

    private static final Set<String> MANAGER_ROLES =
            Set.of(
                    "ADMIN",
                    "PROCUREMENT_MANAGER"
            );

    private final FlywheelResidualContinuationRepository repository;

    private final FlywheelResidualContinuationPolicyService policy;

    public FlywheelResidualContinuationService(
            FlywheelResidualContinuationRepository repository,
            FlywheelResidualContinuationPolicyService policy
    ) {
        this.repository = repository;
        this.policy = policy;
    }

    @Transactional(readOnly = true)
    public FlywheelResidualContinuationDashboardResponse dashboard(
            UUID userId
    ) {
        actor(userId);

        List<FlywheelResidualContinuationCaseResponse> cases =
                repository.cases();

        return new FlywheelResidualContinuationDashboardResponse(
                summary(cases),
                cases,
                repository.eligibleSources()
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualContinuationCaseDetailResponse createCase(
            UUID userId,
            FlywheelResidualContinuationCaseInput input
    ) {
        FlywheelResidualContinuationActor actor =
                actor(userId);

        if (
                repository.existsForSource(
                        input.sourceOutcomeCaseId()
                )
        ) {
            throw new IllegalArgumentException(
                    "A residual continuation already exists for this outcome case."
            );
        }

        FlywheelResidualContinuationSourceResponse source =
                repository.source(
                        input.sourceOutcomeCaseId()
                );

        if (source == null) {
            throw new IllegalArgumentException(
                    "Outcome case is not eligible for residual continuation."
            );
        }

        UUID id =
                UUID.randomUUID();

        if (
                repository.createCase(
                        id,
                        repository.nextContinuationNumber(),
                        source,
                        input.title().trim(),
                        actor
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Residual continuation case was not created."
            );
        }

        return continuationCase(
                userId,
                id
        );
    }

    @Transactional(readOnly = true)
    public FlywheelResidualContinuationCaseDetailResponse continuationCase(
            UUID userId,
            UUID caseId
    ) {
        actor(userId);

        FlywheelResidualContinuationCaseResponse continuation =
                requiredCase(caseId);

        List<FlywheelResidualContinuationItemResponse> items =
                repository.items(caseId);

        List<FlywheelResidualContinuationCandidateResponse> candidates =
                List.of();

        if (
                continuation.status()
                ==
                FlywheelResidualContinuationStatus.DRAFT
        ) {
            Set<UUID> covered =
                    items.stream()
                            .map(
                                    FlywheelResidualContinuationItemResponse
                                        ::sourceOutcomeItemId
                            )
                            .collect(
                                    Collectors.toSet()
                            );

            candidates =
                    repository.candidates(
                                    continuation.sourceOutcomeCaseId()
                            )
                            .stream()
                            .filter(
                                    candidate ->
                                            !covered.contains(
                                                    candidate.outcomeItemId()
                                            )
                            )
                            .toList();
        }

        return new FlywheelResidualContinuationCaseDetailResponse(
                continuation,
                items,
                candidates,
                repository.snapshots(caseId)
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualContinuationCaseDetailResponse addItem(
            UUID userId,
            UUID caseId,
            FlywheelResidualContinuationItemInput input
    ) {
        actor(userId);

        FlywheelResidualContinuationCaseResponse continuation =
                requiredCase(caseId);

        if (
                continuation.status()
                !=
                FlywheelResidualContinuationStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Continuation items can be added only while DRAFT."
            );
        }

        FlywheelResidualContinuationCandidateResponse source =
                repository.candidates(
                                continuation.sourceOutcomeCaseId()
                        )
                        .stream()
                        .filter(
                                candidate ->
                                        candidate.outcomeItemId()
                                                .equals(
                                                        input.sourceOutcomeItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Source residual item does not belong to this continuation."
                                        )
                        );

        boolean alreadyCovered =
                repository.items(caseId)
                        .stream()
                        .anyMatch(
                                item ->
                                        item.sourceOutcomeItemId()
                                                .equals(
                                                        input.sourceOutcomeItemId()
                                                )
                        );

        if (alreadyCovered) {
            throw new IllegalArgumentException(
                    "Continuation governance already exists for this residual item."
            );
        }

        policy.validate(
                source.sourceAction(),
                source.remainingResidualAmount(),
                input.continuationAction(),
                input.targetDate(),
                input.rationale(),
                LocalDate.now()
        );

        if (
                repository.createItem(
                        UUID.randomUUID(),
                        caseId,
                        source,
                        input,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation item was not recorded."
            );
        }

        return continuationCase(
                userId,
                caseId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualContinuationCaseDetailResponse submit(
            UUID userId,
            UUID caseId
    ) {
        actor(userId);

        FlywheelResidualContinuationCaseResponse continuation =
                requiredCase(caseId);

        if (
                continuation.status()
                !=
                FlywheelResidualContinuationStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only DRAFT continuation cases can be submitted."
            );
        }

        requireComplete(
                continuation
        );

        if (
                repository.submit(
                        caseId,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation case could not be submitted."
            );
        }

        return continuationCase(
                userId,
                caseId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualContinuationCaseDetailResponse approve(
            UUID userId,
            UUID caseId,
            FlywheelResidualContinuationNoteInput input
    ) {
        FlywheelResidualContinuationActor actor =
                actor(userId);

        requireManager(actor);

        FlywheelResidualContinuationCaseResponse continuation =
                requiredCase(caseId);

        if (
                continuation.status()
                !=
                FlywheelResidualContinuationStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only IN_REVIEW continuation cases can be approved."
            );
        }

        if (
                repository.approve(
                        caseId,
                        userId,
                        input.note().trim()
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation case could not be approved."
            );
        }

        captureSnapshotInternal(
                userId,
                caseId
        );

        return continuationCase(
                userId,
                caseId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualContinuationCaseDetailResponse close(
            UUID userId,
            UUID caseId,
            FlywheelResidualContinuationNoteInput input
    ) {
        FlywheelResidualContinuationActor actor =
                actor(userId);

        requireManager(actor);

        FlywheelResidualContinuationCaseResponse continuation =
                requiredCase(caseId);

        if (
                continuation.status()
                !=
                FlywheelResidualContinuationStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Only APPROVED continuation cases can be closed."
            );
        }

        if (
                repository.close(
                        caseId,
                        userId,
                        input.note().trim()
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation case could not be closed."
            );
        }

        captureSnapshotInternal(
                userId,
                caseId
        );

        return continuationCase(
                userId,
                caseId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualContinuationSnapshotDetailResponse captureSnapshot(
            UUID userId,
            UUID caseId
    ) {
        actor(userId);

        return captureSnapshotInternal(
                userId,
                caseId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelResidualContinuationSnapshotDetailResponse snapshot(
            UUID userId,
            UUID snapshotId
    ) {
        actor(userId);

        FlywheelResidualContinuationSnapshotSummaryResponse snapshot =
                repository.snapshot(snapshotId);

        if (snapshot == null) {
            throw new IllegalArgumentException(
                    "Residual continuation snapshot does not exist."
            );
        }

        return new FlywheelResidualContinuationSnapshotDetailResponse(
                snapshot,
                repository.snapshotItems(snapshotId)
        );
    }

    private FlywheelResidualContinuationSnapshotDetailResponse captureSnapshotInternal(
            UUID userId,
            UUID caseId
    ) {
        FlywheelResidualContinuationCaseResponse continuation =
                requiredCase(caseId);

        requireComplete(
                continuation
        );

        List<FlywheelResidualContinuationItemResponse> items =
                repository.items(caseId);

        UUID snapshotId =
                UUID.randomUUID();

        if (
                repository.createSnapshot(
                        snapshotId,
                        repository.nextSnapshotNumber(),
                        continuation,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Residual continuation snapshot was not created."
            );
        }

        for (
                FlywheelResidualContinuationItemResponse item
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
                        "Residual continuation snapshot item was not created."
                );
            }
        }

        if (
                repository.sealSnapshot(snapshotId)
                != 1
        ) {
            throw new IllegalStateException(
                    "Residual continuation snapshot was not sealed."
            );
        }

        return new FlywheelResidualContinuationSnapshotDetailResponse(
                repository.snapshot(snapshotId),
                repository.snapshotItems(snapshotId)
        );
    }

    private void requireComplete(
            FlywheelResidualContinuationCaseResponse continuation
    ) {
        List<FlywheelResidualContinuationItemResponse> items =
                repository.items(
                        continuation.id()
                );

        if (
                items.size()
                !=
                continuation.sourceResidualItemCount()
        ) {
            throw new IllegalArgumentException(
                    "Every residual item requires continuation governance."
            );
        }

        BigDecimal actual =
                items.stream()
                        .map(
                                FlywheelResidualContinuationItemResponse
                                    ::sourceRemainingResidualAmount
                        )
                        .reduce(
                                new BigDecimal("0.00"),
                                BigDecimal::add
                        );

        if (
                actual.compareTo(
                        continuation.sourceRemainingResidualAmount()
                )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Continuation governance does not reconcile to source residual."
            );
        }
    }

    private FlywheelResidualContinuationCaseResponse requiredCase(
            UUID id
    ) {
        FlywheelResidualContinuationCaseResponse continuation =
                repository.findCase(id);

        if (continuation == null) {
            throw new IllegalArgumentException(
                    "Residual continuation case does not exist."
            );
        }

        return continuation;
    }

    private FlywheelResidualContinuationActor actor(
            UUID id
    ) {
        FlywheelResidualContinuationActor actor =
                repository.actor(id);

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
            FlywheelResidualContinuationActor actor
    ) {
        if (
                !MANAGER_ROLES.contains(
                        actor.role()
                )
        ) {
            throw new IllegalArgumentException(
                    "Procurement manager approval is required."
            );
        }
    }

    private FlywheelResidualContinuationSummaryResponse summary(
            List<FlywheelResidualContinuationCaseResponse> cases
    ) {
        Map<String, BigDecimal> byCurrency =
                new LinkedHashMap<>();

        for (
                FlywheelResidualContinuationCaseResponse continuation
                : cases
        ) {
            byCurrency.merge(
                    continuation.currency(),
                    continuation.sourceRemainingResidualAmount(),
                    BigDecimal::add
            );
        }

        return new FlywheelResidualContinuationSummaryResponse(
                cases.size(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelResidualContinuationStatus.DRAFT
                        )
                        .count(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelResidualContinuationStatus.IN_REVIEW
                        )
                        .count(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelResidualContinuationStatus.APPROVED
                        )
                        .count(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelResidualContinuationStatus.CLOSED
                        )
                        .count(),

                byCurrency.entrySet()
                        .stream()
                        .map(
                                entry ->
                                        new FlywheelResidualContinuationCurrencyTotal(
                                                entry.getKey(),
                                                entry.getValue()
                                        )
                        )
                        .toList()
        );
    }
}
