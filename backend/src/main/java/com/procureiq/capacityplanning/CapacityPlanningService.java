package com.procureiq.capacityplanning;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.strategicalignment.AlignmentSourceResponse;
import com.procureiq.strategicalignment.StrategicAlignmentDashboardResponse;
import com.procureiq.strategicalignment.StrategicAlignmentService;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class CapacityPlanningService {

    private final CapacityPlanningRepository repository;

    private final CapacityPlanningMathService mathService;

    private final StrategicAlignmentService strategicAlignmentService;

    private final AppUserRepository appUserRepository;

    public CapacityPlanningService(
            CapacityPlanningRepository repository,
            CapacityPlanningMathService mathService,
            StrategicAlignmentService strategicAlignmentService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.strategicAlignmentService =
                strategicAlignmentService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public CapacityPlanningDashboardResponse dashboard(
            UUID currentUserId,
            String currency,
            int fiscalYear
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        StrategicAlignmentDashboardResponse alignment =
                strategicAlignmentService
                        .dashboard(
                                currentUserId,
                                normalizedCurrency,
                                fiscalYear
                        );

        List<CapacityPlanningRepository.ProfileRow> profiles =
                repository
                        .profiles(
                                fiscalYear
                        );

        List<CapacityPlanningRepository.EstimateRow> estimates =
                repository
                        .estimates(
                                normalizedCurrency,
                                fiscalYear
                        );

        List<CapacityPlanningRepository.AssignmentRow> assignments =
                repository
                        .assignmentsForScope(
                                normalizedCurrency,
                                fiscalYear
                        );

        Map<SourceKey, CapacityPlanningRepository.EstimateRow> estimateBySource =
                estimates.stream()
                        .collect(
                                Collectors.toMap(
                                        estimate ->
                                                new SourceKey(
                                                        estimate.sourceType(),
                                                        estimate.sourceEntityId()
                                                ),
                                        estimate ->
                                                estimate
                                )
                        );

        Map<UUID, List<CapacityPlanningRepository.AssignmentRow>> assignmentByEstimate =
                assignments.stream()
                        .collect(
                                Collectors.groupingBy(
                                        CapacityPlanningRepository.AssignmentRow::
                                                workEstimateId
                                )
                        );

        List<CapacityWorkItemResponse> workItems =
                alignment.sources()
                        .stream()
                        .map(
                                source ->
                                        liveWorkItem(
                                                source,
                                                estimateBySource,
                                                assignmentByEstimate
                                        )
                        )
                        .toList();

        List<CapacityMemberResponse> members =
                memberMetrics(
                        profiles,
                        estimates,
                        assignments
                );

        CapacitySummaryResponse summary =
                summary(
                        workItems,
                        members,
                        profiles.size()
                );

        return new CapacityPlanningDashboardResponse(
                normalizedCurrency,
                fiscalYear,
                summary,
                repository.users(),
                profiles.stream()
                        .map(
                                this::profileResponse
                        )
                        .toList(),
                members,
                workItems,
                rebalancingSuggestions(
                        members
                ),
                repository
                        .snapshots(
                                normalizedCurrency,
                                fiscalYear
                        )
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public CapacityProfileResponse saveProfile(
            UUID currentUserId,
            UUID userId,
            int fiscalYear,
            CapacityProfileInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                fiscalYear < 2000
                ||
                fiscalYear > 2200
        ) {
            throw new IllegalArgumentException(
                    "Capacity fiscal year must be between 2000 and 2200."
            );
        }

        AppUserEntity target =
                requireCapacityUser(
                        userId
                );

        CapacityPlanningRepository.ProfileRow existing =
                repository
                        .findProfile(
                                userId,
                                fiscalYear
                        );

        repository.upsertProfile(
                existing == null
                        ? UUID.randomUUID()
                        : existing.id(),
                target.getId(),
                fiscalYear,
                input,
                currentUserId
        );

        return profileResponse(
                repository
                        .findProfile(
                                userId,
                                fiscalYear
                        )
        );
    }

    public CapacityWorkItemResponse createEstimate(
            UUID currentUserId,
            CapacityWorkEstimateInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String currency =
                normalizeCurrency(
                        input.currency()
                );

        if (
                repository
                        .findEstimateBySource(
                                currency,
                                input.fiscalYear(),
                                input.sourceType(),
                                input.sourceEntityId()
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "This strategic work item already has a capacity estimate."
            );
        }

        StrategicAlignmentDashboardResponse alignment =
                strategicAlignmentService
                        .dashboard(
                                currentUserId,
                                currency,
                                input.fiscalYear()
                        );

        AlignmentSourceResponse source =
                alignment.sources()
                        .stream()
                        .filter(
                                candidate ->
                                        candidate
                                                .sourceType()
                                                .name()
                                                .equals(
                                                        input.sourceType()
                                                                .name()
                                                )
                                        &&
                                        candidate
                                                .sourceEntityId()
                                                .equals(
                                                        input.sourceEntityId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Selected work item is not present in the Step 46 strategic portfolio."
                                        )
                        );

        UUID estimateId =
                UUID.randomUUID();

        repository.createEstimate(
                estimateId,
                input,
                currency,
                source.sourceReference(),
                source.sourceTitle(),
                source.sourceStatus(),
                source.dueDate(),
                source.strategicValue(),
                source.riskExposure(),
                source.riskScore(),
                currentUserId
        );

        return workEstimate(
                currentUserId,
                estimateId
        );
    }

    public CapacityWorkItemResponse updateEstimate(
            UUID currentUserId,
            UUID estimateId,
            CapacityWorkEstimateUpdateInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireEstimate(
                estimateId
        );

        repository.updateEstimate(
                estimateId,
                input,
                currentUserId
        );

        return workEstimate(
                currentUserId,
                estimateId
        );
    }

    @Transactional(readOnly = true)
    public CapacityWorkItemResponse workEstimate(
            UUID currentUserId,
            UUID estimateId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapacityPlanningRepository.EstimateRow estimate =
                requireEstimate(
                        estimateId
                );

        List<CapacityPlanningRepository.AssignmentRow> assignments =
                repository
                        .assignments(
                                estimateId
                        );

        return estimatedWorkItem(
                estimate,
                assignments
        );
    }

    public CapacityAssignmentResponse createAssignment(
            UUID currentUserId,
            UUID estimateId,
            CapacityAssignmentInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapacityPlanningRepository.EstimateRow estimate =
                requireEstimate(
                        estimateId
                );

        requireCapacityUser(
                input.userId()
        );

        if (
                repository
                        .findProfile(
                                input.userId(),
                                estimate.fiscalYear()
                        )
                == null
        ) {
            throw new IllegalArgumentException(
                    "The selected team member requires a capacity profile for this fiscal year before assignment."
            );
        }

        if (
                repository
                        .findAssignmentByUser(
                                estimateId,
                                input.userId()
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "The selected team member is already assigned to this work item."
            );
        }

        BigDecimal resultingAllocation =
                repository
                        .assignmentTotal(
                                estimateId
                        )
                        .add(
                                input.allocationPct()
                        );

        if (
                resultingAllocation.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Total work-item allocation cannot exceed 100%."
            );
        }

        UUID assignmentId =
                UUID.randomUUID();

        repository.createAssignment(
                assignmentId,
                estimateId,
                input,
                currentUserId
        );

        return assignmentResponse(
                repository
                        .findAssignment(
                                assignmentId
                        ),
                estimate.estimatedEffortHours()
        );
    }

    public void deleteAssignment(
            UUID currentUserId,
            UUID assignmentId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapacityPlanningRepository.AssignmentRow assignment =
                repository
                        .findAssignment(
                                assignmentId
                        );

        if (assignment == null) {
            throw new ResourceNotFoundException(
                    "Capacity assignment not found: "
                            + assignmentId
            );
        }

        repository.deleteAssignment(
                assignmentId
        );
    }

    public CapacitySnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            String currency,
            int fiscalYear
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapacityPlanningDashboardResponse dashboard =
                dashboard(
                        currentUserId,
                        currency,
                        fiscalYear
                );

        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                dashboard.currency(),
                dashboard.fiscalYear(),
                dashboard.summary(),
                currentUserId
        );

        for (
                CapacityMemberResponse member
                : dashboard.members()
        ) {
            repository.createSnapshotMember(
                    snapshotId,
                    member
            );
        }

        for (
                CapacityWorkItemResponse item
                : dashboard.workItems()
        ) {
            repository.createSnapshotWorkItem(
                    snapshotId,
                    item
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    @Transactional(readOnly = true)
    public CapacitySnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapacityPlanningRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Capacity snapshot not found: "
                            + snapshotId
            );
        }

        CapacitySummaryResponse summary =
                summaryFromSnapshot(
                        snapshot
                );

        List<CapacityMemberResponse> members =
                repository
                        .snapshotMembers(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::snapshotMemberResponse
                        )
                        .toList();

        List<CapacityWorkItemResponse> workItems =
                repository
                        .snapshotWorkItems(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::snapshotWorkResponse
                        )
                        .toList();

        return new CapacitySnapshotDetailResponse(
                snapshotSummary(
                        snapshot
                ),
                summary,
                members,
                workItems
        );
    }

    private List<CapacityMemberResponse> memberMetrics(
            List<CapacityPlanningRepository.ProfileRow> profiles,
            List<CapacityPlanningRepository.EstimateRow> estimates,
            List<CapacityPlanningRepository.AssignmentRow> assignments
    ) {
        Map<UUID, CapacityPlanningRepository.EstimateRow> estimateById =
                estimates.stream()
                        .collect(
                                Collectors.toMap(
                                        CapacityPlanningRepository.EstimateRow::
                                                id,
                                        estimate ->
                                                estimate
                                )
                        );

        Map<UUID, BigDecimal> assignedByUser =
                new HashMap<>();

        for (
                CapacityPlanningRepository.AssignmentRow assignment
                : assignments
        ) {
            CapacityPlanningRepository.EstimateRow estimate =
                    estimateById.get(
                            assignment.workEstimateId()
                    );

            if (estimate == null) {
                continue;
            }

            BigDecimal assignedHours =
                    mathService
                            .assignmentHours(
                                    estimate.estimatedEffortHours(),
                                    assignment.allocationPct()
                            );

            assignedByUser.merge(
                    assignment.userId(),
                    assignedHours,
                    BigDecimal::add
            );
        }

        return profiles.stream()
                .map(
                        profile -> {
                            BigDecimal effective =
                                    mathService
                                            .effectiveCapacity(
                                                    profile.annualCapacityHours(),
                                                    profile.reservedOperationalPct()
                                            );

                            BigDecimal assigned =
                                    decimal(
                                            assignedByUser
                                                    .get(
                                                            profile.userId()
                                                    )
                                    );

                            BigDecimal remaining =
                                    effective
                                            .subtract(
                                                    assigned
                                            )
                                            .max(
                                                    BigDecimal.ZERO
                                            )
                                            .setScale(
                                                    2,
                                                    RoundingMode.HALF_UP
                                            );

                            BigDecimal overload =
                                    assigned
                                            .subtract(
                                                    effective
                                            )
                                            .max(
                                                    BigDecimal.ZERO
                                            )
                                            .setScale(
                                                    2,
                                                    RoundingMode.HALF_UP
                                            );

                            BigDecimal utilization =
                                    mathService
                                            .utilizationPct(
                                                    assigned,
                                                    effective
                                            );

                            return new CapacityMemberResponse(
                                    profile.userId(),
                                    profile.userName(),
                                    profile.role(),
                                    decimal(
                                            profile.annualCapacityHours()
                                    ),
                                    decimal(
                                            profile.reservedOperationalPct()
                                    ),
                                    effective,
                                    assigned,
                                    remaining,
                                    overload,
                                    utilization,
                                    mathService
                                            .memberHealth(
                                                    utilization
                                            )
                            );
                        }
                )
                .sorted(
                        Comparator
                                .comparing(
                                        CapacityMemberResponse::
                                                utilizationPct
                                )
                                .reversed()
                                .thenComparing(
                                        CapacityMemberResponse::
                                                userName
                                )
                )
                .toList();
    }

    private CapacityWorkItemResponse liveWorkItem(
            AlignmentSourceResponse source,
            Map<SourceKey, CapacityPlanningRepository.EstimateRow> estimateBySource,
            Map<UUID, List<CapacityPlanningRepository.AssignmentRow>> assignmentByEstimate
    ) {
        CapacitySourceType sourceType =
                CapacitySourceType.valueOf(
                        source.sourceType()
                                .name()
                );

        CapacityPlanningRepository.EstimateRow estimate =
                estimateBySource.get(
                        new SourceKey(
                                sourceType,
                                source.sourceEntityId()
                        )
                );

        if (estimate == null) {
            boolean deadlinePressure =
                    source.dueDate()
                            != null
                    &&
                    !source.dueDate()
                            .isAfter(
                                    LocalDate.now(
                                            ZoneOffset.UTC
                                    )
                                            .plusDays(
                                                    30
                                            )
                            );

            return new CapacityWorkItemResponse(
                    null,
                    sourceType,
                    source.sourceEntityId(),
                    source.sourceReference(),
                    source.sourceTitle(),
                    source.sourceStatus(),
                    source.dueDate(),
                    decimal(
                            source.strategicValue()
                    ),
                    decimal(
                            source.riskExposure()
                    ),
                    decimal(
                            source.riskScore()
                    ),
                    BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            ),
                    BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            ),
                    BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            ),
                    BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            ),
                    0,
                    CapacityWorkStatus.UNESTIMATED,
                    deadlinePressure,
                    List.of()
            );
        }

        return estimatedWorkItem(
                estimate,
                assignmentByEstimate
                        .getOrDefault(
                                estimate.id(),
                                List.of()
                        )
        );
    }

    private CapacityWorkItemResponse estimatedWorkItem(
            CapacityPlanningRepository.EstimateRow estimate,
            List<CapacityPlanningRepository.AssignmentRow> assignments
    ) {
        BigDecimal allocation =
                assignments.stream()
                        .map(
                                CapacityPlanningRepository.AssignmentRow::
                                        allocationPct
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal assignedHours =
                mathService
                        .assignmentHours(
                                estimate.estimatedEffortHours(),
                                allocation.min(
                                        new BigDecimal(
                                                "100.00"
                                        )
                                )
                        );

        BigDecimal unassigned =
                estimate
                        .estimatedEffortHours()
                        .subtract(
                                assignedHours
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        CapacityWorkStatus status =
                mathService
                        .workStatus(
                                true,
                                allocation
                        );

        boolean deadlinePressure =
                estimate.dueDate()
                        != null
                &&
                !estimate.dueDate()
                        .isAfter(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                                        .plusDays(
                                                30
                                        )
                        )
                &&
                status
                        != CapacityWorkStatus.FULL;

        return new CapacityWorkItemResponse(
                estimate.id(),
                estimate.sourceType(),
                estimate.sourceEntityId(),
                estimate.sourceReference(),
                estimate.sourceTitle(),
                estimate.sourceStatus(),
                estimate.dueDate(),
                decimal(
                        estimate.strategicValue()
                ),
                decimal(
                        estimate.riskExposure()
                ),
                decimal(
                        estimate.riskScore()
                ),
                decimal(
                        estimate.estimatedEffortHours()
                ),
                allocation,
                assignedHours,
                unassigned,
                assignments.size(),
                status,
                deadlinePressure,
                assignments.stream()
                        .map(
                                assignment ->
                                        assignmentResponse(
                                                assignment,
                                                estimate.estimatedEffortHours()
                                        )
                        )
                        .toList()
        );
    }

    private CapacitySummaryResponse summary(
            List<CapacityWorkItemResponse> workItems,
            List<CapacityMemberResponse> members,
            int profileCount
    ) {
        int sourceCount =
                workItems.size();

        int estimatedCount =
                (
                        int
                ) workItems.stream()
                        .filter(
                                item ->
                                        item.estimateId()
                                                != null
                        )
                        .count();

        int fullCount =
                (
                        int
                ) workItems.stream()
                        .filter(
                                item ->
                                        item.planningStatus()
                                                == CapacityWorkStatus.FULL
                        )
                        .count();

        int unassignedCount =
                (
                        int
                ) workItems.stream()
                        .filter(
                                item ->
                                        item.planningStatus()
                                                == CapacityWorkStatus.UNASSIGNED
                                        ||
                                        item.planningStatus()
                                                == CapacityWorkStatus.UNESTIMATED
                        )
                        .count();

        BigDecimal effectiveCapacity =
                members.stream()
                        .map(
                                CapacityMemberResponse::
                                        effectiveCapacityHours
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal demand =
                workItems.stream()
                        .map(
                                CapacityWorkItemResponse::
                                        estimatedEffortHours
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal assigned =
                workItems.stream()
                        .map(
                                CapacityWorkItemResponse::
                                        assignedEffortHours
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal unassigned =
                demand
                        .subtract(
                                assigned
                        )
                        .max(
                                BigDecimal.ZERO
                        );

        BigDecimal gap =
                demand
                        .subtract(
                                effectiveCapacity
                        )
                        .max(
                                BigDecimal.ZERO
                        );

        int deadlinePressure =
                (
                        int
                ) workItems.stream()
                        .filter(
                                CapacityWorkItemResponse::
                                        deadlinePressure
                        )
                        .count();

        int overloaded =
                (
                        int
                ) members.stream()
                        .filter(
                                member ->
                                        member.health()
                                                == CapacityHealth.OVERLOADED
                                ||
                                        member.health()
                                                == CapacityHealth.CRITICAL
                        )
                        .count();

        int critical =
                (
                        int
                ) members.stream()
                        .filter(
                                member ->
                                        member.health()
                                                == CapacityHealth.CRITICAL
                        )
                        .count();

        CapacityScoreResult score =
                mathService
                        .portfolioScore(
                                sourceCount,
                                estimatedCount,
                                demand,
                                assigned,
                                effectiveCapacity,
                                deadlinePressure
                        );

        return new CapacitySummaryResponse(
                sourceCount,
                estimatedCount,
                fullCount,
                unassignedCount,
                profileCount,
                decimal(
                        effectiveCapacity
                ),
                decimal(
                        demand
                ),
                decimal(
                        assigned
                ),
                decimal(
                        unassigned
                ),
                decimal(
                        gap
                ),
                score.estimationCoveragePct(),
                score.assignmentCoveragePct(),
                score.capacityCoveragePct(),
                score.deadlineHealthPct(),
                score.capacityScore(),
                score.health(),
                overloaded,
                critical,
                deadlinePressure
        );
    }

    private List<CapacityRebalanceSuggestionResponse> rebalancingSuggestions(
            List<CapacityMemberResponse> members
    ) {
        List<CapacityMemberResponse> overloaded =
                members.stream()
                        .filter(
                                member ->
                                        member.overloadHours()
                                                .compareTo(
                                                        BigDecimal.ZERO
                                                )
                                        > 0
                        )
                        .sorted(
                                Comparator
                                        .comparing(
                                                CapacityMemberResponse::
                                                        overloadHours
                                        )
                                        .reversed()
                        )
                        .toList();

        List<AvailableCapacity> available =
                members.stream()
                        .filter(
                                member ->
                                        member.remainingCapacityHours()
                                                .compareTo(
                                                        BigDecimal.ZERO
                                                )
                                        > 0
                        )
                        .map(
                                member ->
                                        new AvailableCapacity(
                                                member,
                                                member.remainingCapacityHours()
                                        )
                        )
                        .collect(
                                Collectors.toCollection(
                                        ArrayList::new
                                )
                        );

        List<CapacityRebalanceSuggestionResponse> suggestions =
                new ArrayList<>();

        for (
                CapacityMemberResponse overloadedMember
                : overloaded
        ) {
            BigDecimal remainingOverload =
                    overloadedMember
                            .overloadHours();

            for (
                    int index = 0;
                    index < available.size()
                            &&
                            remainingOverload.compareTo(
                                    BigDecimal.ZERO
                            ) > 0;
                    index++
            ) {
                AvailableCapacity candidate =
                        available.get(
                                index
                        );

                if (
                        candidate.remaining()
                                .compareTo(
                                        BigDecimal.ZERO
                                )
                        <= 0
                ) {
                    continue;
                }

                if (
                        candidate.member()
                                .userId()
                                .equals(
                                        overloadedMember
                                                .userId()
                                )
                ) {
                    continue;
                }

                BigDecimal suggestion =
                        remainingOverload
                                .min(
                                        candidate.remaining()
                                )
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                );

                if (
                        suggestion.compareTo(
                                BigDecimal.ZERO
                        ) <= 0
                ) {
                    continue;
                }

                suggestions.add(
                        new CapacityRebalanceSuggestionResponse(
                                overloadedMember.userId(),
                                overloadedMember.userName(),
                                candidate
                                        .member()
                                        .userId(),
                                candidate
                                        .member()
                                        .userName(),
                                suggestion,
                                "Capacity-only scenario. Validate skills, ownership, continuity and work context before reassigning."
                        )
                );

                remainingOverload =
                        remainingOverload
                                .subtract(
                                        suggestion
                                );

                available.set(
                        index,
                        new AvailableCapacity(
                                candidate.member(),
                                candidate
                                        .remaining()
                                        .subtract(
                                                suggestion
                                        )
                        )
                );
            }
        }

        return suggestions.stream()
                .limit(
                        20
                )
                .toList();
    }

    private CapacityProfileResponse profileResponse(
            CapacityPlanningRepository.ProfileRow row
    ) {
        return new CapacityProfileResponse(
                row.id(),
                row.userId(),
                row.userName(),
                row.role(),
                row.fiscalYear(),
                decimal(
                        row.annualCapacityHours()
                ),
                decimal(
                        row.reservedOperationalPct()
                ),
                mathService
                        .effectiveCapacity(
                                row.annualCapacityHours(),
                                row.reservedOperationalPct()
                        ),
                row.notes(),
                row.version()
        );
    }

    private CapacityAssignmentResponse assignmentResponse(
            CapacityPlanningRepository.AssignmentRow row,
            BigDecimal estimateHours
    ) {
        return new CapacityAssignmentResponse(
                row.id(),
                row.workEstimateId(),
                row.userId(),
                row.userName(),
                row.role(),
                decimal(
                        row.allocationPct()
                ),
                mathService
                        .assignmentHours(
                                estimateHours,
                                row.allocationPct()
                        ),
                row.createdByName(),
                row.createdAt()
        );
    }

    private CapacitySnapshotSummaryResponse snapshotSummary(
            CapacityPlanningRepository.SnapshotRow row
    ) {
        return new CapacitySnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.currency(),
                row.fiscalYear(),
                decimal(
                        row.capacityScore()
                ),
                row.portfolioHealth(),
                decimal(
                        row.effectiveCapacityHours()
                ),
                decimal(
                        row.estimatedDemandHours()
                ),
                decimal(
                        row.capacityGapHours()
                ),
                row.overloadedMemberCount(),
                row.deadlinePressureCount(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private CapacitySummaryResponse summaryFromSnapshot(
            CapacityPlanningRepository.SnapshotRow row
    ) {
        return new CapacitySummaryResponse(
                row.strategicSourceCount(),
                row.estimatedSourceCount(),
                row.fullyAssignedSourceCount(),
                row.unassignedSourceCount(),
                row.profileCount(),
                decimal(
                        row.effectiveCapacityHours()
                ),
                decimal(
                        row.estimatedDemandHours()
                ),
                decimal(
                        row.assignedDemandHours()
                ),
                decimal(
                        row.unassignedDemandHours()
                ),
                decimal(
                        row.capacityGapHours()
                ),
                decimal(
                        row.estimationCoveragePct()
                ),
                decimal(
                        row.assignmentCoveragePct()
                ),
                decimal(
                        row.capacityCoveragePct()
                ),
                decimal(
                        row.deadlineHealthPct()
                ),
                decimal(
                        row.capacityScore()
                ),
                row.portfolioHealth(),
                row.overloadedMemberCount(),
                row.criticalMemberCount(),
                row.deadlinePressureCount()
        );
    }

    private CapacityMemberResponse snapshotMemberResponse(
            CapacityPlanningRepository.SnapshotMemberRow row
    ) {
        BigDecimal overload =
                row.assignedEffortHours()
                        .subtract(
                                row.effectiveCapacityHours()
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        return new CapacityMemberResponse(
                row.userId(),
                row.userName(),
                row.role(),
                decimal(
                        row.annualCapacityHours()
                ),
                decimal(
                        row.reservedOperationalPct()
                ),
                decimal(
                        row.effectiveCapacityHours()
                ),
                decimal(
                        row.assignedEffortHours()
                ),
                decimal(
                        row.remainingCapacityHours()
                ),
                overload,
                decimal(
                        row.utilizationPct()
                ),
                row.health()
        );
    }

    private CapacityWorkItemResponse snapshotWorkResponse(
            CapacityPlanningRepository.SnapshotWorkRow row
    ) {
        return new CapacityWorkItemResponse(
                null,
                row.sourceType(),
                row.sourceEntityId(),
                row.sourceReference(),
                row.sourceTitle(),
                row.sourceStatus(),
                row.dueDate(),
                decimal(
                        row.strategicValue()
                ),
                decimal(
                        row.riskExposure()
                ),
                decimal(
                        row.riskScore()
                ),
                decimal(
                        row.estimatedEffortHours()
                ),
                decimal(
                        row.allocationPct()
                ),
                decimal(
                        row.assignedEffortHours()
                ),
                decimal(
                        row.unassignedEffortHours()
                ),
                row.assignmentCount(),
                row.planningStatus(),
                row.deadlinePressure(),
                List.of()
        );
    }

    private CapacityPlanningRepository.EstimateRow requireEstimate(
            UUID estimateId
    ) {
        CapacityPlanningRepository.EstimateRow estimate =
                repository
                        .findEstimate(
                                estimateId
                        );

        if (estimate == null) {
            throw new ResourceNotFoundException(
                    "Capacity work estimate not found: "
                            + estimateId
            );
        }

        return estimate;
    }

    private AppUserEntity requireCapacityUser(
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
                    "Requester accounts cannot receive strategic capacity assignments."
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

    private String nextSnapshotNumber() {
        return String.format(
                "CAP-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextSnapshotSequence()
        );
    }

    private String normalizeCurrency(
            String currency
    ) {
        if (
                currency == null
                ||
                currency.trim()
                        .length()
                        != 3
        ) {
            throw new IllegalArgumentException(
                    "Capacity-planning currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private BigDecimal decimal(
            BigDecimal value
    ) {
        return mathService
                .decimal(
                        value
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
                    "Your ProcureIQ role cannot access strategic capacity planning."
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
                    "Your ProcureIQ role cannot manage strategic capacity planning."
            );
        }
    }

    private record SourceKey(
            CapacitySourceType sourceType,
            UUID sourceEntityId
    ) {
    }

    private record AvailableCapacity(
            CapacityMemberResponse member,
            BigDecimal remaining
    ) {
    }
}
