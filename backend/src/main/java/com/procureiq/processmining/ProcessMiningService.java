package com.procureiq.processmining;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class ProcessMiningService {

    private final ProcessMiningRepository repository;

    private final AppUserRepository appUserRepository;

    public ProcessMiningService(
            ProcessMiningRepository repository,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public ProcessMiningDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<ProcessBottleneckResponse> bottlenecks =
                repository
                        .bottlenecks()
                        .stream()
                        .map(
                                this::bottleneckResponse
                        )
                        .toList();

        List<ProcessDeviationResponse> deviations =
                deviations(
                        bottlenecks
                );

        long criticalBottlenecks =
                bottlenecks.stream()
                        .filter(
                                bottleneck ->
                                        bottleneck.severity()
                                                == ProcessBottleneckSeverity.CRITICAL
                        )
                        .count();

        long cancelledFlows =
                deviations.stream()
                        .filter(
                                deviation ->
                                        deviation.deviationType()
                                                == ProcessDeviationType.CANCELLED_FLOW
                        )
                        .count();

        long repeatedStages =
                deviations.stream()
                        .filter(
                                deviation ->
                                        deviation.deviationType()
                                                == ProcessDeviationType.REPEATED_STAGE
                        )
                        .count();

        ProcessMiningSummaryResponse summary =
                new ProcessMiningSummaryResponse(
                        repository.trackedEntities(),
                        repository.liveTransitions(),
                        repository.activeEntities(),
                        bottlenecks.size(),
                        criticalBottlenecks,
                        cancelledFlows,
                        repeatedStages,
                        repository
                                .averageObservedCycleHours()
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                )
                );

        return new ProcessMiningDashboardResponse(
                summary,
                repository.stageMetrics(),
                bottlenecks,
                repository.departmentMetrics(),
                repository.categoryMetrics(),
                deviations,
                recommendations(
                        summary,
                        bottlenecks,
                        deviations
                ),
                repository.targets(),
                repository.recentEvents()
        );
    }

    @Transactional(readOnly = true)
    public List<ProcessStageTargetResponse> targets(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return repository.targets();
    }

    public ProcessStageTargetResponse upsertTarget(
            UUID currentUserId,
            ProcessStageTargetInput input
    ) {
        assertTargetRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String status =
                input.status()
                        .trim()
                        .toUpperCase();

        if (status.isEmpty()) {
            throw new IllegalArgumentException(
                    "Process stage status cannot be empty."
            );
        }

        return repository.upsertTarget(
                new ProcessStageTargetInput(
                        input.entityType(),
                        status,
                        input.targetHours()
                )
        );
    }

    private ProcessBottleneckResponse bottleneckResponse(
            ProcessMiningRepository.BottleneckRow row
    ) {
        ProcessBottleneckSeverity severity =
                row.targetRatio()
                                .compareTo(
                                        new BigDecimal(
                                                "2.00"
                                        )
                                )
                                >= 0
                        ? ProcessBottleneckSeverity.CRITICAL
                        : ProcessBottleneckSeverity.WARNING;

        return new ProcessBottleneckResponse(
                row.entityType(),
                row.entityId(),
                row.entityReference(),
                row.status(),
                row.departmentId(),
                row.departmentName(),
                row.category(),
                row.ageHours(),
                row.targetHours(),
                row.targetRatio(),
                severity,
                row.enteredStageAt()
        );
    }

    private List<ProcessDeviationResponse> deviations(
            List<ProcessBottleneckResponse> bottlenecks
    ) {
        List<ProcessDeviationResponse> result =
                new ArrayList<>();

        for (
                ProcessBottleneckResponse bottleneck
                : bottlenecks
        ) {
            result.add(
                    new ProcessDeviationResponse(
                            ProcessDeviationType.SLA_BREACH,
                            bottleneck.entityType(),
                            bottleneck.entityId(),
                            bottleneck.entityReference(),
                            bottleneck.status(),
                            "Stage age "
                                    + bottleneck.ageHours()
                                    + "h exceeds target "
                                    + bottleneck.targetHours()
                                    + "h.",
                            bottleneck.enteredStageAt()
                    )
            );
        }

        repository
                .repeatedStageDeviations()
                .forEach(
                        row ->
                                result.add(
                                        deviationResponse(
                                                row
                                        )
                                )
                );

        repository
                .cancelledFlowDeviations()
                .forEach(
                        row ->
                                result.add(
                                        deviationResponse(
                                                row
                                        )
                                )
                );

        result.sort(
                Comparator.comparing(
                        ProcessDeviationResponse::
                                detectedAt
                )
                        .reversed()
        );

        return result.stream()
                .limit(
                        100
                )
                .toList();
    }

    private ProcessDeviationResponse deviationResponse(
            ProcessMiningRepository.DeviationRow row
    ) {
        return new ProcessDeviationResponse(
                row.deviationType(),
                row.entityType(),
                row.entityId(),
                row.entityReference(),
                row.status(),
                row.details(),
                row.detectedAt()
        );
    }

    private List<ProcessRecommendationResponse> recommendations(
            ProcessMiningSummaryResponse summary,
            List<ProcessBottleneckResponse> bottlenecks,
            List<ProcessDeviationResponse> deviations
    ) {
        List<ProcessRecommendationResponse> recommendations =
                new ArrayList<>();

        if (
                summary.liveTransitions()
                        == 0
        ) {
            recommendations.add(
                    new ProcessRecommendationResponse(
                            "INFO",
                            "Build live process history",
                            "Current-state snapshots have been backfilled. Cycle-time analytics will become progressively authoritative as live procurement status transitions are captured."
                    )
            );
        }

        Map<
                ProcessEntityType,
                Long
        > bottleneckCounts =
                new EnumMap<>(
                        ProcessEntityType.class
                );

        for (
                ProcessBottleneckResponse bottleneck
                : bottlenecks
        ) {
            bottleneckCounts.merge(
                    bottleneck.entityType(),
                    1L,
                    Long::sum
            );
        }

        addRecommendation(
                recommendations,
                bottleneckCounts,
                ProcessEntityType.APPROVAL,
                "HIGH",
                "Reduce approval queue time",
                "Review approval capacity, threshold routing and approver availability for requests that are exceeding the configured approval SLA."
        );

        addRecommendation(
                recommendations,
                bottleneckCounts,
                ProcessEntityType.RFQ,
                "HIGH",
                "Accelerate sourcing execution",
                "Review RFQ preparation and supplier-response lead times; use guided templates and consolidated demand where recurring sourcing stages are delayed."
        );

        addRecommendation(
                recommendations,
                bottleneckCounts,
                ProcessEntityType.PURCHASE_ORDER,
                "MEDIUM",
                "Investigate PO-to-receipt delays",
                "Prioritize issued purchase orders that remain open beyond target and review supplier delivery commitments, overdue receipts and corrective actions."
        );

        addRecommendation(
                recommendations,
                bottleneckCounts,
                ProcessEntityType.GOODS_RECEIPT,
                "MEDIUM",
                "Tighten receipt processing",
                "Review delayed receipt confirmation and operational handoff so downstream invoice matching is not blocked."
        );

        addRecommendation(
                recommendations,
                bottleneckCounts,
                ProcessEntityType.INVOICE,
                "HIGH",
                "Clear invoice-control bottlenecks",
                "Prioritize invoice match exceptions and payment holds to reduce AP aging and prevent avoidable payment delays."
        );

        long repeated =
                deviations.stream()
                        .filter(
                                deviation ->
                                        deviation.deviationType()
                                                == ProcessDeviationType.REPEATED_STAGE
                        )
                        .count();

        if (repeated > 0) {
            recommendations.add(
                    new ProcessRecommendationResponse(
                            "MEDIUM",
                            "Investigate workflow rework",
                            repeated
                                    + " repeated-stage deviations were detected. Review common causes of reopened or recycled process stages."
                    )
            );
        }

        long cancelled =
                deviations.stream()
                        .filter(
                                deviation ->
                                        deviation.deviationType()
                                                == ProcessDeviationType.CANCELLED_FLOW
                        )
                        .count();

        if (cancelled > 0) {
            recommendations.add(
                    new ProcessRecommendationResponse(
                            "MEDIUM",
                            "Analyze terminated procurement flows",
                            cancelled
                                    + " recent processes ended in cancellation, rejection, withdrawal or termination. Review whether intake quality, approvals or sourcing readiness are contributing."
                    )
            );
        }

        if (
                summary.criticalBottlenecks()
                        > 0
        ) {
            recommendations.add(
                    0,
                    new ProcessRecommendationResponse(
                            "CRITICAL",
                            "Escalate critical SLA breaches",
                            summary.criticalBottlenecks()
                                    + " active items exceed at least twice their configured process-stage target."
                    )
            );
        }

        if (recommendations.isEmpty()) {
            recommendations.add(
                    new ProcessRecommendationResponse(
                            "INFO",
                            "Process flow is within current thresholds",
                            "No material bottleneck recommendation is currently generated from the configured stage targets."
                    )
            );
        }

        return List.copyOf(
                recommendations
        );
    }

    private void addRecommendation(
            List<ProcessRecommendationResponse> recommendations,
            Map<
                    ProcessEntityType,
                    Long
            > bottleneckCounts,
            ProcessEntityType entityType,
            String priority,
            String title,
            String details
    ) {
        long count =
                bottleneckCounts.getOrDefault(
                        entityType,
                        0L
                );

        if (count <= 0) {
            return;
        }

        recommendations.add(
                new ProcessRecommendationResponse(
                        priority,
                        title,
                        details
                                + " Active bottlenecks: "
                                + count
                                + "."
                )
        );
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
                                                "Authenticated ProcureIQ user not found."
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "The authenticated ProcureIQ account is inactive."
            );
        }

        return user;
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
                    "Your ProcureIQ role cannot access process-mining intelligence."
            );
        }
    }

    private void assertTargetRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can change process SLA targets."
            );
        }
    }
}
