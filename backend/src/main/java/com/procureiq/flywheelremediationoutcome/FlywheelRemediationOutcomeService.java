package com.procureiq.flywheelremediationoutcome;

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

@Service
public class FlywheelRemediationOutcomeService {

    private static final Set<String> MANAGER_ROLES =
            Set.of(
                    "ADMIN",
                    "PROCUREMENT_MANAGER"
            );

    private final FlywheelRemediationOutcomeRepository repository;

    private final FlywheelRemediationOutcomePolicyService policy;

    public FlywheelRemediationOutcomeService(
            FlywheelRemediationOutcomeRepository repository,
            FlywheelRemediationOutcomePolicyService policy
    ) {
        this.repository = repository;
        this.policy = policy;
    }

    @Transactional(readOnly = true)
    public FlywheelRemediationOutcomeDashboardResponse dashboard(
            UUID userId
    ) {
        actor(
                userId
        );

        List<FlywheelRemediationOutcomeCaseResponse> cases =
                repository.cases();

        return new FlywheelRemediationOutcomeDashboardResponse(
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
    public FlywheelRemediationOutcomeCaseDetailResponse createCase(
            UUID userId,
            FlywheelRemediationOutcomeCaseInput input
    ) {
        FlywheelRemediationOutcomeActor actor =
                actor(
                        userId
                );

        if (
                repository.hasCaseForSource(
                        input.sourceRemediationPlanId()
                )
        ) {
            throw new IllegalArgumentException(
                    "A remediation outcome case already exists for this plan."
            );
        }

        FlywheelRemediationOutcomeSourceResponse source =
                repository.findSource(
                        input.sourceRemediationPlanId()
                );

        if (source == null) {
            throw new IllegalArgumentException(
                    "Remediation plan is not eligible for outcome assurance."
            );
        }

        UUID id =
                UUID.randomUUID();

        if (
                repository.createCase(
                        id,
                        repository.nextOutcomeNumber(),
                        source,
                        input.title().trim(),
                        actor
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Remediation outcome case was not created."
            );
        }

        return outcomeCase(
                userId,
                id
        );
    }

    @Transactional(readOnly = true)
    public FlywheelRemediationOutcomeCaseDetailResponse outcomeCase(
            UUID userId,
            UUID caseId
    ) {
        actor(
                userId
        );

        FlywheelRemediationOutcomeCaseResponse outcome =
                requiredCase(
                        caseId
                );

        List<FlywheelRemediationOutcomeItemResponse> items =
                repository.items(
                        caseId
                );

        List<FlywheelRemediationOutcomeCandidateResponse> candidates =
                List.of();

        if (
                outcome.status()
                ==
                FlywheelRemediationOutcomeStatus.DRAFT
        ) {
            Set<UUID> covered =
                    items.stream()
                            .map(
                                    FlywheelRemediationOutcomeItemResponse
                                        ::sourceRemediationItemId
                            )
                            .collect(
                                    java.util.stream.Collectors
                                        .toSet()
                            );

            candidates =
                    repository.candidates(
                                    outcome.sourceRemediationPlanId()
                            )
                            .stream()
                            .filter(
                                    candidate ->
                                            !covered.contains(
                                                    candidate.remediationItemId()
                                            )
                            )
                            .toList();
        }

        return new FlywheelRemediationOutcomeCaseDetailResponse(
                outcome,
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
    public FlywheelRemediationOutcomeCaseDetailResponse addItem(
            UUID userId,
            UUID caseId,
            FlywheelRemediationOutcomeItemInput input
    ) {
        actor(
                userId
        );

        FlywheelRemediationOutcomeCaseResponse outcome =
                requiredCase(
                        caseId
                );

        if (
                outcome.status()
                !=
                FlywheelRemediationOutcomeStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Outcome evidence can be added only while DRAFT."
            );
        }

        FlywheelRemediationOutcomeCandidateResponse source =
                repository.candidates(
                                outcome.sourceRemediationPlanId()
                        )
                        .stream()
                        .filter(
                                candidate ->
                                        candidate.remediationItemId()
                                                .equals(
                                                        input.sourceRemediationItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Source remediation item does not belong to this outcome case."
                                        )
                        );

        boolean alreadyCovered =
                repository.items(
                                caseId
                        )
                        .stream()
                        .anyMatch(
                                item ->
                                        item.sourceRemediationItemId()
                                                .equals(
                                                        input.sourceRemediationItemId()
                                                )
                        );

        if (alreadyCovered) {
            throw new IllegalArgumentException(
                    "Outcome evidence already exists for this remediation item."
            );
        }

        policy.validateOutcome(
                source.sourceAction(),
                source.sourceResidualAmount(),
                input.resolutionType(),
                input.resolvedAmount(),
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
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Outcome evidence was not recorded."
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
    public FlywheelRemediationOutcomeCaseDetailResponse submit(
            UUID userId,
            UUID caseId
    ) {
        actor(
                userId
        );

        FlywheelRemediationOutcomeCaseResponse outcome =
                requiredCase(
                        caseId
                );

        if (
                outcome.status()
                !=
                FlywheelRemediationOutcomeStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only DRAFT outcome cases can be submitted."
            );
        }

        List<FlywheelRemediationOutcomeCandidateResponse> expected =
                repository.candidates(
                        outcome.sourceRemediationPlanId()
                );

        List<FlywheelRemediationOutcomeItemResponse> actual =
                repository.items(
                        caseId
                );

        if (
                expected.size()
                !=
                actual.size()
        ) {
            throw new IllegalArgumentException(
                    "Every remediation decision requires outcome evidence."
            );
        }

        BigDecimal expectedSource =
                expected.stream()
                        .map(
                                FlywheelRemediationOutcomeCandidateResponse
                                    ::sourceResidualAmount
                        )
                        .reduce(
                                new BigDecimal(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );

        BigDecimal actualSource =
                actual.stream()
                        .map(
                                FlywheelRemediationOutcomeItemResponse
                                    ::sourceResidualAmount
                        )
                        .reduce(
                                new BigDecimal(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );

        if (
                expectedSource.compareTo(
                        actualSource
                )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Outcome evidence does not reconcile to source remediation."
            );
        }

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
    public FlywheelRemediationOutcomeCaseDetailResponse verify(
            UUID userId,
            UUID caseId,
            FlywheelRemediationOutcomeNoteInput input
    ) {
        FlywheelRemediationOutcomeActor actor =
                actor(
                        userId
                );

        requireManager(
                actor
        );

        FlywheelRemediationOutcomeCaseResponse outcome =
                requiredCase(
                        caseId
                );

        if (
                outcome.status()
                !=
                FlywheelRemediationOutcomeStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only IN_REVIEW outcome cases can be verified."
            );
        }

        if (
                repository.verify(
                        caseId,
                        userId,
                        input.note().trim()
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
    public FlywheelRemediationOutcomeCaseDetailResponse close(
            UUID userId,
            UUID caseId,
            FlywheelRemediationOutcomeNoteInput input
    ) {
        FlywheelRemediationOutcomeActor actor =
                actor(
                        userId
                );

        requireManager(
                actor
        );

        FlywheelRemediationOutcomeCaseResponse outcome =
                requiredCase(
                        caseId
                );

        if (
                outcome.status()
                !=
                FlywheelRemediationOutcomeStatus.VERIFIED
        ) {
            throw new IllegalArgumentException(
                    "Only VERIFIED outcome cases can be closed."
            );
        }

        if (
                outcome.remainingResidualAmount()
                        .signum()
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Outcome case cannot close while financial residual remains."
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
    public FlywheelRemediationOutcomeSnapshotDetailResponse captureSnapshot(
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
    public FlywheelRemediationOutcomeSnapshotDetailResponse snapshot(
            UUID userId,
            UUID snapshotId
    ) {
        actor(
                userId
        );

        FlywheelRemediationOutcomeSnapshotSummaryResponse snapshot =
                repository.findSnapshot(
                        snapshotId
                );

        if (snapshot == null) {
            throw new IllegalArgumentException(
                    "Remediation outcome snapshot does not exist."
            );
        }

        return new FlywheelRemediationOutcomeSnapshotDetailResponse(
                snapshot,
                repository.snapshotItems(
                        snapshotId
                )
        );
    }

    private FlywheelRemediationOutcomeSnapshotDetailResponse captureSnapshotInternal(
            UUID userId,
            UUID caseId
    ) {
        FlywheelRemediationOutcomeCaseResponse outcome =
                requiredCase(
                        caseId
                );

        List<FlywheelRemediationOutcomeItemResponse> items =
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
                    "Outcome snapshot was not created."
            );
        }

        for (
                FlywheelRemediationOutcomeItemResponse item
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
                        "Outcome snapshot item was not created."
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
                    "Outcome snapshot was not sealed."
            );
        }

        return new FlywheelRemediationOutcomeSnapshotDetailResponse(
                repository.findSnapshot(
                        snapshotId
                ),
                repository.snapshotItems(
                        snapshotId
                )
        );
    }

    private FlywheelRemediationOutcomeCaseResponse requiredCase(
            UUID id
    ) {
        FlywheelRemediationOutcomeCaseResponse outcome =
                repository.findCase(
                        id
                );

        if (outcome == null) {
            throw new IllegalArgumentException(
                    "Remediation outcome case does not exist."
            );
        }

        return outcome;
    }

    private FlywheelRemediationOutcomeActor actor(
            UUID userId
    ) {
        FlywheelRemediationOutcomeActor actor =
                repository.actor(
                        userId
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
            FlywheelRemediationOutcomeActor actor
    ) {
        if (
                !MANAGER_ROLES.contains(
                        actor.role()
                )
        ) {
            throw new IllegalArgumentException(
                    "Procurement manager verification is required."
            );
        }
    }

    private FlywheelRemediationOutcomeSummaryResponse summary(
            List<FlywheelRemediationOutcomeCaseResponse> cases
    ) {
        Map<String, BigDecimal> currencies =
                new LinkedHashMap<>();

        for (
                FlywheelRemediationOutcomeCaseResponse outcome
                : cases
        ) {
            currencies.merge(
                    outcome.currency(),
                    outcome.remainingResidualAmount(),
                    BigDecimal::add
            );
        }

        return new FlywheelRemediationOutcomeSummaryResponse(
                cases.size(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelRemediationOutcomeStatus.DRAFT
                        )
                        .count(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelRemediationOutcomeStatus.IN_REVIEW
                        )
                        .count(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelRemediationOutcomeStatus.VERIFIED
                        )
                        .count(),

                cases.stream()
                        .filter(
                                value ->
                                        value.status()
                                        ==
                                        FlywheelRemediationOutcomeStatus.CLOSED
                        )
                        .count(),

                currencies.entrySet()
                        .stream()
                        .map(
                                entry ->
                                        new FlywheelRemediationOutcomeCurrencyTotal(
                                                entry.getKey(),
                                                entry.getValue()
                                        )
                        )
                        .toList()
        );
    }
}
