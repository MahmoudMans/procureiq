package com.procureiq.flywheelcontinuationoutcome;

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
public class FlywheelContinuationOutcomeService {

    private static final Set<String> MANAGER_ROLES =
            Set.of(
                    "ADMIN",
                    "PROCUREMENT_MANAGER"
            );

    private final FlywheelContinuationOutcomeRepository repository;

    private final FlywheelContinuationOutcomePolicyService policy;

    public FlywheelContinuationOutcomeService(
            FlywheelContinuationOutcomeRepository repository,
            FlywheelContinuationOutcomePolicyService policy
    ) {
        this.repository = repository;
        this.policy = policy;
    }

    @Transactional(readOnly = true)
    public FlywheelContinuationOutcomeDashboardResponse dashboard(
            UUID userId
    ) {
        actor(userId);

        List<FlywheelContinuationOutcomeCaseResponse> cases =
                repository.cases();

        return new FlywheelContinuationOutcomeDashboardResponse(
                summary(cases),
                cases,
                repository.eligibleSources()
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationOutcomeCaseDetailResponse createCase(
            UUID userId,
            FlywheelContinuationOutcomeCaseInput input
    ) {
        FlywheelContinuationOutcomeActor actor =
                actor(userId);

        if (
                repository.existsForSource(
                        input.sourceContinuationCaseId()
                )
        ) {
            throw new IllegalArgumentException(
                    "An outcome case already exists for this continuation."
            );
        }

        FlywheelContinuationOutcomeSourceResponse source =
                repository.source(
                        input.sourceContinuationCaseId()
                );

        if (source == null) {
            throw new IllegalArgumentException(
                    "Only CLOSED continuation cases are eligible for outcome evidence."
            );
        }

        UUID id =
                UUID.randomUUID();

        if (
                repository.createCase(
                        id,
                        repository.nextOutcomeNumber(),
                        source,
                        actor
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation outcome case was not created."
            );
        }

        return outcomeCase(
                userId,
                id
        );
    }

    @Transactional(readOnly = true)
    public FlywheelContinuationOutcomeCaseDetailResponse outcomeCase(
            UUID userId,
            UUID caseId
    ) {
        actor(userId);

        FlywheelContinuationOutcomeCaseResponse outcome =
                requiredCase(caseId);

        List<FlywheelContinuationOutcomeItemResponse> items =
                repository.items(caseId);

        List<FlywheelContinuationOutcomeCandidateResponse> candidates =
                List.of();

        if (
                outcome.status()
                ==
                FlywheelContinuationOutcomeStatus.DRAFT
        ) {
            Set<UUID> covered =
                    items.stream()
                            .map(
                                    FlywheelContinuationOutcomeItemResponse
                                        ::sourceContinuationItemId
                            )
                            .collect(
                                    Collectors.toSet()
                            );

            candidates =
                    repository.candidates(
                                    outcome.sourceContinuationCaseId()
                            )
                            .stream()
                            .filter(
                                    candidate ->
                                            !covered.contains(
                                                    candidate.continuationItemId()
                                            )
                            )
                            .toList();
        }

        return new FlywheelContinuationOutcomeCaseDetailResponse(
                outcome,
                items,
                candidates,
                repository.snapshots(caseId)
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationOutcomeCaseDetailResponse addItem(
            UUID userId,
            UUID caseId,
            FlywheelContinuationOutcomeItemInput input
    ) {
        actor(userId);

        FlywheelContinuationOutcomeCaseResponse outcome =
                requiredCase(caseId);

        if (
                outcome.status()
                !=
                FlywheelContinuationOutcomeStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Outcome evidence can be recorded only while DRAFT."
            );
        }

        FlywheelContinuationOutcomeCandidateResponse source =
                repository.candidates(
                                outcome.sourceContinuationCaseId()
                        )
                        .stream()
                        .filter(
                                candidate ->
                                        candidate.continuationItemId()
                                                .equals(
                                                        input.sourceContinuationItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Source continuation item does not belong to this outcome case."
                                        )
                        );

        boolean duplicate =
                repository.items(caseId)
                        .stream()
                        .anyMatch(
                                item ->
                                        item.sourceContinuationItemId()
                                                .equals(
                                                        input.sourceContinuationItemId()
                                                )
                        );

        if (duplicate) {
            throw new IllegalArgumentException(
                    "Observed outcome evidence already exists for this continuation item."
            );
        }

        BigDecimal remaining =
                policy.validateAndRemaining(
                        source.continuationAction(),
                        source.sourceResidualAmount(),
                        input.resolutionType(),
                        input.observedReductionAmount(),
                        input.observedOn(),
                        input.evidenceReference(),
                        input.evidenceNote(),
                        LocalDate.now()
                );

        if (
                repository.createItem(
                        UUID.randomUUID(),
                        caseId,
                        source,
                        input,
                        remaining,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation outcome evidence was not recorded."
            );
        }

        return outcomeCase(
                userId,
                caseId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationOutcomeCaseDetailResponse submit(
            UUID userId,
            UUID caseId
    ) {
        actor(userId);

        FlywheelContinuationOutcomeCaseResponse outcome =
                requiredCase(caseId);

        if (
                outcome.status()
                !=
                FlywheelContinuationOutcomeStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only DRAFT outcome cases can be submitted."
            );
        }

        requireComplete(
                outcome
        );

        if (
                repository.submit(
                        caseId,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Outcome case could not be submitted."
            );
        }

        return outcomeCase(
                userId,
                caseId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationOutcomeCaseDetailResponse verify(
            UUID userId,
            UUID caseId,
            FlywheelContinuationOutcomeNoteInput input
    ) {
        FlywheelContinuationOutcomeActor actor =
                actor(userId);

        requireManager(actor);

        FlywheelContinuationOutcomeCaseResponse outcome =
                requiredCase(caseId);

        if (
                outcome.status()
                !=
                FlywheelContinuationOutcomeStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only IN_REVIEW outcome cases can be verified."
            );
        }

        requireComplete(
                outcome
        );

        BigDecimal remaining =
                repository.items(caseId)
                        .stream()
                        .map(
                                FlywheelContinuationOutcomeItemResponse
                                    ::remainingResidualAmount
                        )
                        .reduce(
                                new BigDecimal(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );

        FlywheelContinuationOutcomeResidualDisposition disposition =
                policy.disposition(
                        remaining
                );

        if (
                repository.verify(
                        caseId,
                        userId,
                        input.note().trim(),
                        remaining,
                        disposition
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Outcome case could not be verified."
            );
        }

        captureSnapshotInternal(
                userId,
                caseId
        );

        return outcomeCase(
                userId,
                caseId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationOutcomeCaseDetailResponse close(
            UUID userId,
            UUID caseId,
            FlywheelContinuationOutcomeNoteInput input
    ) {
        FlywheelContinuationOutcomeActor actor =
                actor(userId);

        requireManager(actor);

        FlywheelContinuationOutcomeCaseResponse outcome =
                requiredCase(caseId);

        if (
                outcome.status()
                !=
                FlywheelContinuationOutcomeStatus.VERIFIED
        ) {
            throw new IllegalArgumentException(
                    "Only VERIFIED outcome cases can be closed."
            );
        }

        if (
                outcome.residualDisposition()
                !=
                FlywheelContinuationOutcomeResidualDisposition.FULLY_RESOLVED

                ||

                outcome.verifiedRemainingResidualAmount() == null

                ||

                outcome.verifiedRemainingResidualAmount()
                        .signum()
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Positive residual requires further governance and cannot be closed."
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
                    "Outcome case could not be closed."
            );
        }

        captureSnapshotInternal(
                userId,
                caseId
        );

        return outcomeCase(
                userId,
                caseId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelContinuationOutcomeSnapshotDetailResponse captureSnapshot(
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
    public FlywheelContinuationOutcomeSnapshotDetailResponse snapshot(
            UUID userId,
            UUID snapshotId
    ) {
        actor(userId);

        FlywheelContinuationOutcomeSnapshotSummaryResponse snapshot =
                repository.snapshot(
                        snapshotId
                );

        if (snapshot == null) {
            throw new IllegalArgumentException(
                    "Continuation outcome snapshot does not exist."
            );
        }

        return new FlywheelContinuationOutcomeSnapshotDetailResponse(
                snapshot,
                repository.snapshotItems(
                        snapshotId
                )
        );
    }

    private FlywheelContinuationOutcomeSnapshotDetailResponse captureSnapshotInternal(
            UUID userId,
            UUID caseId
    ) {
        FlywheelContinuationOutcomeCaseResponse outcome =
                requiredCase(
                        caseId
                );

        requireComplete(
                outcome
        );

        List<FlywheelContinuationOutcomeItemResponse> items =
                repository.items(
                        caseId
                );

        UUID snapshotId =
                UUID.randomUUID();

        if (
                repository.createSnapshot(
                        snapshotId,
                        repository.nextSnapshotNumber(),
                        outcome,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Continuation outcome snapshot was not created."
            );
        }

        for (
                FlywheelContinuationOutcomeItemResponse item
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
                        "Continuation outcome snapshot item was not created."
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
                    "Continuation outcome snapshot was not sealed."
            );
        }

        return new FlywheelContinuationOutcomeSnapshotDetailResponse(
                repository.snapshot(
                        snapshotId
                ),
                repository.snapshotItems(
                        snapshotId
                )
        );
    }

    private void requireComplete(
            FlywheelContinuationOutcomeCaseResponse outcome
    ) {
        List<FlywheelContinuationOutcomeItemResponse> items =
                repository.items(
                        outcome.id()
                );

        if (
                items.size()
                !=
                outcome.sourceItemCount()
        ) {
            throw new IllegalArgumentException(
                    "Every continuation item requires observed outcome evidence."
            );
        }

        BigDecimal sourceTotal =
                items.stream()
                        .map(
                                FlywheelContinuationOutcomeItemResponse
                                    ::sourceResidualAmount
                        )
                        .reduce(
                                new BigDecimal(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );

        if (
                sourceTotal.compareTo(
                        outcome.sourceResidualAmount()
                )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Outcome evidence does not reconcile to source continuation residual."
            );
        }
    }

    private FlywheelContinuationOutcomeCaseResponse requiredCase(
            UUID id
    ) {
        FlywheelContinuationOutcomeCaseResponse outcome =
                repository.findCase(
                        id
                );

        if (outcome == null) {
            throw new IllegalArgumentException(
                    "Continuation outcome case does not exist."
            );
        }

        return outcome;
    }

    private FlywheelContinuationOutcomeActor actor(
            UUID id
    ) {
        FlywheelContinuationOutcomeActor actor =
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
            FlywheelContinuationOutcomeActor actor
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

    private FlywheelContinuationOutcomeSummaryResponse summary(
            List<FlywheelContinuationOutcomeCaseResponse> cases
    ) {
        Map<String, BigDecimal> residualByCurrency =
                new LinkedHashMap<>();

        for (
                FlywheelContinuationOutcomeCaseResponse outcome
                : cases
        ) {
            residualByCurrency.merge(
                    outcome.currency(),
                    outcome.currentRemainingResidualAmount(),
                    BigDecimal::add
            );
        }

        return new FlywheelContinuationOutcomeSummaryResponse(
                cases.size(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelContinuationOutcomeStatus.DRAFT
                        )
                        .count(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelContinuationOutcomeStatus.IN_REVIEW
                        )
                        .count(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelContinuationOutcomeStatus.VERIFIED
                        )
                        .count(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelContinuationOutcomeStatus.CLOSED
                        )
                        .count(),

                cases.stream()
                        .filter(
                                value ->
                                        value.residualDisposition()
                                        ==
                                        FlywheelContinuationOutcomeResidualDisposition
                                                .FURTHER_GOVERNANCE_REQUIRED
                        )
                        .count(),

                residualByCurrency.entrySet()
                        .stream()
                        .map(
                                entry ->
                                        new FlywheelContinuationOutcomeCurrencyTotal(
                                                entry.getKey(),
                                                entry.getValue()
                                        )
                        )
                        .toList()
        );
    }
}
