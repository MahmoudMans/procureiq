package com.procureiq.flywheelremediation;

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
public class FlywheelResidualRemediationService {

    private static final Set<String> MANAGER_ROLES =
            Set.of(
                    "ADMIN",
                    "PROCUREMENT_MANAGER"
            );

    private final FlywheelResidualRemediationRepository repository;

    private final FlywheelResidualRemediationPolicyService policy;

    public FlywheelResidualRemediationService(
            FlywheelResidualRemediationRepository repository,
            FlywheelResidualRemediationPolicyService policy
    ) {
        this.repository = repository;
        this.policy = policy;
    }

    @Transactional(readOnly = true)
    public FlywheelResidualRemediationDashboardResponse dashboard(
            UUID userId
    ) {
        actor(
                userId
        );

        List<FlywheelResidualRemediationPlanResponse> plans =
                repository.plans();

        return new FlywheelResidualRemediationDashboardResponse(
                summary(
                        plans
                ),
                plans,
                repository.eligibleSources()
        );
    }

    @Transactional(readOnly = true)
    public List<FlywheelResidualRemediationSourceResponse> sources(
            UUID userId
    ) {
        actor(
                userId
        );

        return repository.eligibleSources();
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualRemediationPlanDetailResponse createPlan(
            UUID userId,
            FlywheelResidualRemediationPlanInput input
    ) {
        FlywheelResidualRemediationActor actor =
                actor(
                        userId
                );

        if (
                repository.hasPlanForSource(
                        input.sourceExecutionCaseId()
                )
        ) {
            throw new IllegalArgumentException(
                    "A residual remediation plan already exists for this execution case."
            );
        }

        FlywheelResidualRemediationSourceResponse source =
                requiredSource(
                        input.sourceExecutionCaseId()
                );

        UUID planId =
                UUID.randomUUID();

        if (
                repository.createPlan(
                        planId,
                        repository.nextPlanNumber(),
                        source,
                        input.title().trim(),
                        input.remediationObjective().trim(),
                        actor
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Residual remediation plan was not created."
            );
        }

        return plan(
                userId,
                planId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelResidualRemediationPlanDetailResponse plan(
            UUID userId,
            UUID planId
    ) {
        actor(
                userId
        );

        FlywheelResidualRemediationPlanResponse plan =
                requiredPlan(
                        planId
                );

        List<FlywheelResidualRemediationItemResponse> items =
                repository.items(
                        planId
                );

        List<FlywheelResidualRemediationCandidateResponse> candidates =
                List.of();

        if (
                plan.status()
                ==
                FlywheelResidualRemediationPlanStatus.DRAFT
        ) {
            Set<UUID> existing =
                    items.stream()
                            .map(
                                    FlywheelResidualRemediationItemResponse
                                        ::sourceExecutionItemId
                            )
                            .collect(
                                    java.util.stream.Collectors
                                        .toSet()
                            );

            candidates =
                    repository.candidates(
                                    plan.sourceExecutionCaseId()
                            )
                            .stream()
                            .filter(
                                    candidate ->
                                            !existing.contains(
                                                    candidate.executionItemId()
                                            )
                            )
                            .toList();
        }

        return new FlywheelResidualRemediationPlanDetailResponse(
                plan,
                items,
                candidates,
                repository.snapshots(
                        planId
                )
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualRemediationPlanDetailResponse addItem(
            UUID userId,
            UUID planId,
            FlywheelResidualRemediationItemInput input
    ) {
        actor(
                userId
        );

        FlywheelResidualRemediationPlanResponse plan =
                requiredPlan(
                        planId
                );

        if (
                plan.status()
                !=
                FlywheelResidualRemediationPlanStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Residual remediation decisions can be added only while DRAFT."
            );
        }

        FlywheelResidualRemediationCandidateResponse source =
                repository.candidates(
                                plan.sourceExecutionCaseId()
                        )
                        .stream()
                        .filter(
                                candidate ->
                                        candidate.executionItemId()
                                                .equals(
                                                        input.sourceExecutionItemId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "The selected source item has no positive residual."
                                        )
                        );

        boolean alreadyExists =
                repository.items(
                                planId
                        )
                        .stream()
                        .anyMatch(
                                item ->
                                        item.sourceExecutionItemId()
                                                .equals(
                                                        input.sourceExecutionItemId()
                                                )
                        );

        if (alreadyExists) {
            throw new IllegalArgumentException(
                    "A remediation decision already exists for this source item."
            );
        }

        policy.validateItem(
                source.sourceDecision(),
                source.residualAmount(),
                input.action(),
                input.targetDate(),
                input.rationale(),
                LocalDate.now()
        );

        if (
                repository.createItem(
                        UUID.randomUUID(),
                        planId,
                        source,
                        input,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Residual remediation decision was not created."
            );
        }

        return plan(
                userId,
                planId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualRemediationPlanDetailResponse submit(
            UUID userId,
            UUID planId
    ) {
        actor(
                userId
        );

        FlywheelResidualRemediationPlanResponse plan =
                requiredPlan(
                        planId
                );

        if (
                plan.status()
                !=
                FlywheelResidualRemediationPlanStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only DRAFT remediation plans can be submitted."
            );
        }

        List<FlywheelResidualRemediationCandidateResponse> sourceItems =
                repository.candidates(
                        plan.sourceExecutionCaseId()
                );

        List<FlywheelResidualRemediationItemResponse> decisions =
                repository.items(
                        planId
                );

        if (
                sourceItems.size()
                !=
                decisions.size()
        ) {
            throw new IllegalArgumentException(
                    "Every positive residual execution item requires one remediation decision."
            );
        }

        BigDecimal sourceResidual =
                sourceItems.stream()
                        .map(
                                FlywheelResidualRemediationCandidateResponse
                                    ::residualAmount
                        )
                        .reduce(
                                new BigDecimal(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );

        BigDecimal governedResidual =
                decisions.stream()
                        .map(
                                FlywheelResidualRemediationItemResponse
                                    ::residualAmount
                        )
                        .reduce(
                                new BigDecimal(
                                        "0.00"
                                ),
                                BigDecimal::add
                        );

        if (
                sourceResidual.compareTo(
                        governedResidual
                )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Remediation decisions do not reconcile to source residual."
            );
        }

        if (
                repository.submit(
                        planId,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Residual remediation plan could not be submitted."
            );
        }

        return plan(
                userId,
                planId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualRemediationPlanDetailResponse approve(
            UUID userId,
            UUID planId,
            FlywheelResidualRemediationNoteInput input
    ) {
        FlywheelResidualRemediationActor actor =
                actor(
                        userId
                );

        requireManager(
                actor
        );

        FlywheelResidualRemediationPlanResponse plan =
                requiredPlan(
                        planId
                );

        if (
                plan.status()
                !=
                FlywheelResidualRemediationPlanStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only IN_REVIEW remediation plans can be approved."
            );
        }

        if (
                repository.approve(
                        planId,
                        userId,
                        input.note().trim()
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Residual remediation plan could not be approved."
            );
        }

        captureSnapshotInternal(
                userId,
                planId
        );

        return plan(
                userId,
                planId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualRemediationPlanDetailResponse close(
            UUID userId,
            UUID planId,
            FlywheelResidualRemediationNoteInput input
    ) {
        FlywheelResidualRemediationActor actor =
                actor(
                        userId
                );

        requireManager(
                actor
        );

        FlywheelResidualRemediationPlanResponse plan =
                requiredPlan(
                        planId
                );

        if (
                plan.status()
                !=
                FlywheelResidualRemediationPlanStatus.APPROVED
        ) {
            throw new IllegalArgumentException(
                    "Only APPROVED remediation plans can be closed."
            );
        }

        if (
                repository.close(
                        planId,
                        userId,
                        input.note().trim()
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Residual remediation plan could not be closed."
            );
        }

        captureSnapshotInternal(
                userId,
                planId
        );

        return plan(
                userId,
                planId
        );
    }

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public FlywheelResidualRemediationSnapshotDetailResponse captureSnapshot(
            UUID userId,
            UUID planId
    ) {
        actor(
                userId
        );

        return captureSnapshotInternal(
                userId,
                planId
        );
    }

    @Transactional(readOnly = true)
    public FlywheelResidualRemediationSnapshotDetailResponse snapshot(
            UUID userId,
            UUID snapshotId
    ) {
        actor(
                userId
        );

        FlywheelResidualRemediationSnapshotSummaryResponse snapshot =
                repository.snapshot(
                        snapshotId
                );

        if (snapshot == null) {
            throw new IllegalArgumentException(
                    "Residual remediation snapshot does not exist."
            );
        }

        return new FlywheelResidualRemediationSnapshotDetailResponse(
                snapshot,
                repository.snapshotItems(
                        snapshotId
                )
        );
    }

    private FlywheelResidualRemediationSnapshotDetailResponse captureSnapshotInternal(
            UUID userId,
            UUID planId
    ) {
        FlywheelResidualRemediationPlanResponse plan =
                requiredPlan(
                        planId
                );

        List<FlywheelResidualRemediationItemResponse> items =
                repository.items(
                        planId
                );

        UUID snapshotId =
                UUID.randomUUID();

        if (
                repository.createSnapshot(
                        snapshotId,
                        repository.nextSnapshotNumber(),
                        plan,
                        userId
                )
                != 1
        ) {
            throw new IllegalStateException(
                    "Residual remediation snapshot could not be created."
            );
        }

        for (
                FlywheelResidualRemediationItemResponse item
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
                        "Residual remediation snapshot item could not be created."
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
                    "Residual remediation snapshot could not be sealed."
            );
        }

        return new FlywheelResidualRemediationSnapshotDetailResponse(
                repository.snapshot(
                        snapshotId
                ),
                repository.snapshotItems(
                        snapshotId
                )
        );
    }

    private FlywheelResidualRemediationSourceResponse requiredSource(
            UUID sourceId
    ) {
        FlywheelResidualRemediationSourceResponse source =
                repository.source(
                        sourceId
                );

        if (source == null) {
            throw new IllegalArgumentException(
                    "Execution case is not eligible for residual remediation."
            );
        }

        return source;
    }

    private FlywheelResidualRemediationPlanResponse requiredPlan(
            UUID planId
    ) {
        FlywheelResidualRemediationPlanResponse plan =
                repository.plan(
                        planId
                );

        if (plan == null) {
            throw new IllegalArgumentException(
                    "Residual remediation plan does not exist."
            );
        }

        return plan;
    }

    private FlywheelResidualRemediationActor actor(
            UUID userId
    ) {
        FlywheelResidualRemediationActor actor =
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
            FlywheelResidualRemediationActor actor
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

    private FlywheelResidualRemediationSummaryResponse summary(
            List<FlywheelResidualRemediationPlanResponse> plans
    ) {
        Map<String, BigDecimal> currencies =
                new LinkedHashMap<>();

        for (
                FlywheelResidualRemediationPlanResponse plan
                : plans
        ) {
            currencies.merge(
                    plan.currency(),
                    plan.sourceResidualAmount(),
                    BigDecimal::add
            );
        }

        return new FlywheelResidualRemediationSummaryResponse(
                plans.size(),

                plans.stream()
                        .filter(
                                plan ->
                                        plan.status()
                                        ==
                                        FlywheelResidualRemediationPlanStatus.DRAFT
                        )
                        .count(),

                plans.stream()
                        .filter(
                                plan ->
                                        plan.status()
                                        ==
                                        FlywheelResidualRemediationPlanStatus.IN_REVIEW
                        )
                        .count(),

                plans.stream()
                        .filter(
                                plan ->
                                        plan.status()
                                        ==
                                        FlywheelResidualRemediationPlanStatus.APPROVED
                        )
                        .count(),

                plans.stream()
                        .filter(
                                plan ->
                                        plan.status()
                                        ==
                                        FlywheelResidualRemediationPlanStatus.CLOSED
                        )
                        .count(),

                currencies.entrySet()
                        .stream()
                        .map(
                                entry ->
                                        new FlywheelResidualRemediationCurrencyTotal(
                                                entry.getKey(),
                                                entry.getValue()
                                        )
                        )
                        .toList()
        );
    }
}
