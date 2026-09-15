package com.procureiq.strategycockpit;

import com.procureiq.capabilityplanning.CapabilityPlanningDashboardResponse;
import com.procureiq.capabilityplanning.CapabilityPlanningService;
import com.procureiq.capacityplanning.CapacityPlanningDashboardResponse;
import com.procureiq.capacityplanning.CapacityPlanningService;
import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.strategicalignment.ObjectiveAlignmentSummaryResponse;
import com.procureiq.strategicalignment.StrategicAlignmentDashboardResponse;
import com.procureiq.strategicalignment.StrategicAlignmentService;
import com.procureiq.successionplanning.SuccessionPlanningDashboardResponse;
import com.procureiq.successionplanning.SuccessionPlanningService;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class StrategyCockpitService {

    private static final BigDecimal OBJECTIVE_WEIGHT =
            new BigDecimal(
                    "25.00"
            );

    private static final BigDecimal ALIGNMENT_WEIGHT =
            new BigDecimal(
                    "20.00"
            );

    private static final BigDecimal CAPACITY_WEIGHT =
            new BigDecimal(
                    "20.00"
            );

    private static final BigDecimal CAPABILITY_WEIGHT =
            new BigDecimal(
                    "20.00"
            );

    private static final BigDecimal SUCCESSION_WEIGHT =
            new BigDecimal(
                    "15.00"
            );

    private final StrategyCockpitRepository repository;

    private final StrategyCockpitMathService mathService;

    private final StrategicAlignmentService strategicAlignmentService;

    private final CapacityPlanningService capacityPlanningService;

    private final CapabilityPlanningService capabilityPlanningService;

    private final SuccessionPlanningService successionPlanningService;

    private final AppUserRepository appUserRepository;

    public StrategyCockpitService(
            StrategyCockpitRepository repository,
            StrategyCockpitMathService mathService,
            StrategicAlignmentService strategicAlignmentService,
            CapacityPlanningService capacityPlanningService,
            CapabilityPlanningService capabilityPlanningService,
            SuccessionPlanningService successionPlanningService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.strategicAlignmentService =
                strategicAlignmentService;

        this.capacityPlanningService =
                capacityPlanningService;

        this.capabilityPlanningService =
                capabilityPlanningService;

        this.successionPlanningService =
                successionPlanningService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public StrategyCockpitDashboardResponse dashboard(
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

        LiveBoard live =
                liveBoard(
                        currentUserId,
                        normalizedCurrency,
                        fiscalYear
                );

        return new StrategyCockpitDashboardResponse(
                live.summary(),
                live.dimensions(),
                live.exceptions(),
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

    public BoardSnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            String currency,
            int fiscalYear,
            BoardScorecardCaptureInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        StrategyCockpitRepository.SnapshotRow previous =
                repository
                        .latestSnapshot(
                                normalizedCurrency,
                                fiscalYear
                        );

        LiveBoard live =
                liveBoard(
                        currentUserId,
                        normalizedCurrency,
                        fiscalYear
                );

        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                live.summary(),
                previous,
                input == null
                        ? null
                        : input.boardCommentary(),
                currentUserId
        );

        for (
                BoardDimensionResponse dimension
                : live.dimensions()
        ) {
            repository.createDimension(
                    snapshotId,
                    dimension
            );
        }

        for (
                BoardExceptionResponse exception
                : live.exceptions()
        ) {
            repository.createException(
                    snapshotId,
                    exception
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    @Transactional(readOnly = true)
    public BoardSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategyCockpitRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Procurement board scorecard snapshot not found: "
                            + snapshotId
            );
        }

        return new BoardSnapshotDetailResponse(
                snapshotSummary(
                        snapshot
                ),
                summaryFromSnapshot(
                        snapshot
                ),
                repository
                        .dimensions(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::dimensionResponse
                        )
                        .toList(),
                repository
                        .exceptions(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::exceptionResponse
                        )
                        .toList()
        );
    }

    private LiveBoard liveBoard(
            UUID currentUserId,
            String currency,
            int fiscalYear
    ) {
        StrategicAlignmentDashboardResponse alignment =
                strategicAlignmentService
                        .dashboard(
                                currentUserId,
                                currency,
                                fiscalYear
                        );

        CapacityPlanningDashboardResponse capacity =
                capacityPlanningService
                        .dashboard(
                                currentUserId,
                                currency,
                                fiscalYear
                        );

        CapabilityPlanningDashboardResponse capability =
                capabilityPlanningService
                        .dashboard(
                                currentUserId,
                                currency,
                                fiscalYear
                        );

        SuccessionPlanningDashboardResponse succession =
                successionPlanningService
                        .dashboard(
                                currentUserId,
                                currency,
                                fiscalYear
                        );

        BigDecimal objectiveExecutionScore =
                mathService
                        .average(
                                alignment
                                        .objectives()
                                        .stream()
                                        .map(
                                                ObjectiveAlignmentSummaryResponse::
                                                        okrProgressPct
                                        )
                                        .toList()
                        );

        BigDecimal strategicAlignmentScore =
                mathService
                        .boundedScore(
                                alignment
                                        .summary()
                                        .alignmentScore()
                        );

        BigDecimal capacityScore =
                mathService
                        .boundedScore(
                                capacity
                                        .summary()
                                        .capacityScore()
                        );

        BigDecimal capabilityScore =
                mathService
                        .boundedScore(
                                capability
                                        .summary()
                                        .capabilityScore()
                        );

        BigDecimal successionScore =
                mathService
                        .boundedScore(
                                succession
                                        .summary()
                                        .successionScore()
                        );

        List<WeightedBoardDimension> weighted =
                List.of(
                        new WeightedBoardDimension(
                                BoardDimensionKey.OBJECTIVE_EXECUTION,
                                objectiveExecutionScore,
                                OBJECTIVE_WEIGHT
                        ),
                        new WeightedBoardDimension(
                                BoardDimensionKey.STRATEGIC_ALIGNMENT,
                                strategicAlignmentScore,
                                ALIGNMENT_WEIGHT
                        ),
                        new WeightedBoardDimension(
                                BoardDimensionKey.CAPACITY_READINESS,
                                capacityScore,
                                CAPACITY_WEIGHT
                        ),
                        new WeightedBoardDimension(
                                BoardDimensionKey.CAPABILITY_READINESS,
                                capabilityScore,
                                CAPABILITY_WEIGHT
                        ),
                        new WeightedBoardDimension(
                                BoardDimensionKey.SUCCESSION_RESILIENCE,
                                successionScore,
                                SUCCESSION_WEIGHT
                        )
                );

        BigDecimal overall =
                mathService
                        .weightedScore(
                                weighted
                        );

        StrategyCockpitRepository.SnapshotRow previous =
                repository
                        .latestSnapshot(
                                currency,
                                fiscalYear
                        );

        BigDecimal previousOverall =
                previous == null
                        ? null
                        : previous.overallScore();

        List<BoardExceptionResponse> exceptions =
                exceptions(
                        alignment,
                        capacity,
                        capability,
                        succession
                );

        int offTrackObjectives =
                (
                        int
                ) alignment
                        .objectives()
                        .stream()
                        .filter(
                                objective ->
                                        objective
                                                .okrHealth()
                                                .name()
                                                .equals(
                                                        "OFF_TRACK"
                                                )
                        )
                        .count();

        int criticalExceptions =
                (
                        int
                ) exceptions.stream()
                        .filter(
                                exception ->
                                        exception.severity()
                                                == BoardExceptionSeverity.CRITICAL
                        )
                        .count();

        String generatedSummary =
                generatedSummary(
                        overall,
                        mathService
                                .health(
                                        overall
                                ),
                        objectiveExecutionScore,
                        strategicAlignmentScore,
                        capacityScore,
                        capabilityScore,
                        successionScore,
                        exceptions
                );

        BoardScorecardSummaryResponse summary =
                new BoardScorecardSummaryResponse(
                        currency,
                        fiscalYear,
                        objectiveExecutionScore,
                        strategicAlignmentScore,
                        capacityScore,
                        capabilityScore,
                        successionScore,
                        overall,
                        mathService
                                .health(
                                        overall
                                ),
                        previousOverall,
                        mathService
                                .delta(
                                        overall,
                                        previousOverall
                                ),
                        mathService
                                .movement(
                                        overall,
                                        previousOverall
                                ),
                        alignment
                                .objectives()
                                .size(),
                        offTrackObjectives,
                        alignment
                                .summary()
                                .unalignedSourceCount(),
                        capacity
                                .summary()
                                .overloadedMemberCount(),
                        capability
                                .summary()
                                .criticalGapCount(),
                        succession
                                .summary()
                                .singlePointFailureCount(),
                        exceptions.size(),
                        criticalExceptions,
                        generatedSummary
                );

        List<BoardDimensionResponse> dimensions =
                dimensions(
                        weighted,
                        previous,
                        alignment,
                        capacity,
                        capability,
                        succession
                );

        return new LiveBoard(
                summary,
                dimensions,
                exceptions
        );
    }

    private List<BoardDimensionResponse> dimensions(
            List<WeightedBoardDimension> weighted,
            StrategyCockpitRepository.SnapshotRow previous,
            StrategicAlignmentDashboardResponse alignment,
            CapacityPlanningDashboardResponse capacity,
            CapabilityPlanningDashboardResponse capability,
            SuccessionPlanningDashboardResponse succession
    ) {
        Map<BoardDimensionKey, BigDecimal> previousScores =
                new EnumMap<>(
                        BoardDimensionKey.class
                );

        if (previous != null) {
            previousScores.put(
                    BoardDimensionKey.OBJECTIVE_EXECUTION,
                    previous.objectiveExecutionScore()
            );

            previousScores.put(
                    BoardDimensionKey.STRATEGIC_ALIGNMENT,
                    previous.strategicAlignmentScore()
            );

            previousScores.put(
                    BoardDimensionKey.CAPACITY_READINESS,
                    previous.capacityScore()
            );

            previousScores.put(
                    BoardDimensionKey.CAPABILITY_READINESS,
                    previous.capabilityScore()
            );

            previousScores.put(
                    BoardDimensionKey.SUCCESSION_RESILIENCE,
                    previous.successionScore()
            );
        }

        List<BoardDimensionResponse> dimensions =
                new ArrayList<>();

        for (
                WeightedBoardDimension dimension
                : weighted
        ) {
            BigDecimal previousScore =
                    previousScores
                            .get(
                                    dimension.key()
                            );

            dimensions.add(
                    new BoardDimensionResponse(
                            dimension.key(),
                            label(
                                    dimension.key()
                            ),
                            dimension.weightPct(),
                            mathService
                                    .boundedScore(
                                            dimension.score()
                                    ),
                            mathService
                                    .contribution(
                                            dimension.score(),
                                            dimension.weightPct()
                                    ),
                            mathService
                                    .health(
                                            dimension.score()
                                    ),
                            previousScore,
                            mathService
                                    .delta(
                                            dimension.score(),
                                            previousScore
                                    ),
                            sourceDetail(
                                    dimension.key(),
                                    alignment,
                                    capacity,
                                    capability,
                                    succession
                            )
                    )
            );
        }

        return dimensions;
    }

    private List<BoardExceptionResponse> exceptions(
            StrategicAlignmentDashboardResponse alignment,
            CapacityPlanningDashboardResponse capacity,
            CapabilityPlanningDashboardResponse capability,
            SuccessionPlanningDashboardResponse succession
    ) {
        List<BoardExceptionResponse> exceptions =
                new ArrayList<>();

        int offTrack =
                (
                        int
                ) alignment
                        .objectives()
                        .stream()
                        .filter(
                                objective ->
                                        objective
                                                .okrHealth()
                                                .name()
                                                .equals(
                                                        "OFF_TRACK"
                                                )
                        )
                        .count();

        if (
                alignment
                        .objectives()
                        .isEmpty()
        ) {
            exceptions.add(
                    exception(
                            "MISSING_OBJECTIVES",
                            BoardExceptionType.MISSING_OBJECTIVES,
                            BoardExceptionSeverity.HIGH,
                            "No strategic objectives in scope",
                            "The selected fiscal-year scope contains no active procurement strategic objectives.",
                            0,
                            BigDecimal.ZERO,
                            "/strategic-objectives"
                    )
            );
        }

        if (offTrack > 0) {
            exceptions.add(
                    exception(
                            "OBJECTIVE_OFF_TRACK",
                            BoardExceptionType.OBJECTIVE_OFF_TRACK,
                            offTrack >= 3
                                    ? BoardExceptionSeverity.HIGH
                                    : BoardExceptionSeverity.MEDIUM,
                            "Strategic objectives are off track",
                            offTrack
                                    + " procurement objective(s) are currently classified as off track.",
                            offTrack,
                            BigDecimal.valueOf(
                                    offTrack
                            ),
                            "/strategic-objectives"
                    )
            );
        }

        int unaligned =
                alignment
                        .summary()
                        .unalignedSourceCount();

        if (unaligned > 0) {
            exceptions.add(
                    exception(
                            "UNALIGNED_STRATEGIC_WORK",
                            BoardExceptionType.UNALIGNED_STRATEGIC_WORK,
                            unaligned >= 5
                                    ? BoardExceptionSeverity.HIGH
                                    : BoardExceptionSeverity.MEDIUM,
                            "Strategic work remains unaligned",
                            unaligned
                                    + " active strategic work item(s) are not linked to a governed procurement objective.",
                            unaligned,
                            BigDecimal.valueOf(
                                    unaligned
                            ),
                            "/strategic-alignment"
                    )
            );
        }

        int deadlineConflict =
                alignment
                        .summary()
                        .deadlineConflictCount();

        if (deadlineConflict > 0) {
            exceptions.add(
                    exception(
                            "STRATEGIC_DEADLINE_CONFLICT",
                            BoardExceptionType.STRATEGIC_DEADLINE_CONFLICT,
                            deadlineConflict >= 3
                                    ? BoardExceptionSeverity.HIGH
                                    : BoardExceptionSeverity.MEDIUM,
                            "Strategy-to-work deadline conflicts",
                            deadlineConflict
                                    + " objective/work alignment deadline conflict(s) require executive attention.",
                            deadlineConflict,
                            BigDecimal.valueOf(
                                    deadlineConflict
                            ),
                            "/strategic-alignment"
                    )
            );
        }

        if (
                capacity
                        .summary()
                        .profileCount()
                == 0
        ) {
            exceptions.add(
                    exception(
                            "MISSING_CAPACITY_PROFILE",
                            BoardExceptionType.MISSING_CAPACITY_PROFILE,
                            BoardExceptionSeverity.HIGH,
                            "Strategic capacity is not configured",
                            "No fiscal-year strategic capacity profiles exist for the selected scope.",
                            0,
                            BigDecimal.ZERO,
                            "/capacity-planning"
                    )
            );
        }

        BigDecimal capacityGap =
                capacity
                        .summary()
                        .capacityGapHours();

        if (
                capacityGap.compareTo(
                        BigDecimal.ZERO
                ) > 0
        ) {
            BigDecimal demand =
                    capacity
                            .summary()
                            .estimatedDemandHours();

            BigDecimal gapPct =
                    demand.compareTo(
                            BigDecimal.ZERO
                    ) <= 0
                            ? BigDecimal.ZERO
                            : capacityGap
                                    .multiply(
                                            new BigDecimal(
                                                    "100.00"
                                            )
                                    )
                                    .divide(
                                            demand,
                                            2,
                                            RoundingMode.HALF_UP
                                    );

            exceptions.add(
                    exception(
                            "CAPACITY_GAP",
                            BoardExceptionType.CAPACITY_GAP,
                            gapPct.compareTo(
                                    new BigDecimal(
                                            "25.00"
                                    )
                            ) >= 0
                                    ? BoardExceptionSeverity.CRITICAL
                                    : BoardExceptionSeverity.HIGH,
                            "Strategic demand exceeds effective capacity",
                            "Current estimated strategic demand exceeds configured effective capacity by "
                                    + capacityGap.setScale(
                                            0,
                                            RoundingMode.HALF_UP
                                    )
                                    + " hours.",
                            1,
                            capacityGap,
                            "/capacity-planning"
                    )
            );
        }

        int overloaded =
                capacity
                        .summary()
                        .overloadedMemberCount();

        if (overloaded > 0) {
            exceptions.add(
                    exception(
                            "CAPACITY_OVERLOAD",
                            BoardExceptionType.CAPACITY_OVERLOAD,
                            capacity
                                    .summary()
                                    .criticalMemberCount()
                                    > 0
                                    ? BoardExceptionSeverity.CRITICAL
                                    : BoardExceptionSeverity.HIGH,
                            "Procurement team overload",
                            overloaded
                                    + " strategic-capacity profile(s) are overloaded or critical.",
                            overloaded,
                            BigDecimal.valueOf(
                                    overloaded
                            ),
                            "/capacity-planning"
                    )
            );
        }

        int deadlinePressure =
                capacity
                        .summary()
                        .deadlinePressureCount();

        if (deadlinePressure > 0) {
            exceptions.add(
                    exception(
                            "CAPACITY_DEADLINE_PRESSURE",
                            BoardExceptionType.CAPACITY_DEADLINE_PRESSURE,
                            deadlinePressure >= 5
                                    ? BoardExceptionSeverity.HIGH
                                    : BoardExceptionSeverity.MEDIUM,
                            "Near-term strategic delivery pressure",
                            deadlinePressure
                                    + " strategic work item(s) have unresolved capacity within the 30-day deadline-pressure window.",
                            deadlinePressure,
                            BigDecimal.valueOf(
                                    deadlinePressure
                            ),
                            "/capacity-planning"
                    )
            );
        }

        int criticalCapabilityGaps =
                capability
                        .summary()
                        .criticalGapCount();

        if (criticalCapabilityGaps > 0) {
            exceptions.add(
                    exception(
                            "CAPABILITY_CRITICAL_GAP",
                            BoardExceptionType.CAPABILITY_CRITICAL_GAP,
                            BoardExceptionSeverity.CRITICAL,
                            "Critical capability gaps",
                            criticalCapabilityGaps
                                    + " critical proficiency gap(s) exist across strategically assigned work.",
                            criticalCapabilityGaps,
                            BigDecimal.valueOf(
                                    criticalCapabilityGaps
                            ),
                            "/capability-planning"
                    )
            );
        }

        int workWithoutRequirements =
                capability
                        .summary()
                        .strategicWorkCount()
                -
                capability
                        .summary()
                        .workWithRequirementsCount();

        if (workWithoutRequirements > 0) {
            exceptions.add(
                    exception(
                            "CAPABILITY_REQUIREMENT_GAP",
                            BoardExceptionType.CAPABILITY_REQUIREMENT_GAP,
                            workWithoutRequirements >= 5
                                    ? BoardExceptionSeverity.HIGH
                                    : BoardExceptionSeverity.MEDIUM,
                            "Capability requirements are incomplete",
                            workWithoutRequirements
                                    + " strategic work item(s) have no governed capability requirements.",
                            workWithoutRequirements,
                            BigDecimal.valueOf(
                                    workWithoutRequirements
                            ),
                            "/capability-planning"
                    )
            );
        }

        if (
                succession
                        .summary()
                        .policyCount()
                == 0
        ) {
            exceptions.add(
                    exception(
                            "MISSING_SUCCESSION_POLICY",
                            BoardExceptionType.MISSING_SUCCESSION_POLICY,
                            BoardExceptionSeverity.HIGH,
                            "Critical-capability succession is undefined",
                            "No critical-capability succession policies exist for the selected scope.",
                            0,
                            BigDecimal.ZERO,
                            "/succession-planning"
                    )
            );
        }

        int spof =
                succession
                        .summary()
                        .singlePointFailureCount();

        if (spof > 0) {
            exceptions.add(
                    exception(
                            "SUCCESSION_SINGLE_POINT_FAILURE",
                            BoardExceptionType.SUCCESSION_SINGLE_POINT_FAILURE,
                            BoardExceptionSeverity.CRITICAL,
                            "Single-point-of-failure workforce exposure",
                            spof
                                    + " governed critical capability policy/policies depend on one or fewer ready people.",
                            spof,
                            BigDecimal.valueOf(
                                    spof
                            ),
                            "/succession-planning"
                    )
            );
        }

        int criticalExposure =
                succession
                        .summary()
                        .criticalExposureCount();

        if (criticalExposure > 0) {
            exceptions.add(
                    exception(
                            "SUCCESSION_CRITICAL_EXPOSURE",
                            BoardExceptionType.SUCCESSION_CRITICAL_EXPOSURE,
                            BoardExceptionSeverity.CRITICAL,
                            "Critical succession coverage below target",
                            criticalExposure
                                    + " critical capability policy/policies remain below their governed target depth.",
                            criticalExposure,
                            BigDecimal.valueOf(
                                    criticalExposure
                            ),
                            "/succession-planning"
                    )
            );
        }

        return exceptions.stream()
                .sorted(
                        (
                                first,
                                second
                        ) -> {
                            int severityCompare =
                                    Integer.compare(
                                            severityRank(
                                                    first.severity()
                                            ),
                                            severityRank(
                                                    second.severity()
                                            )
                                    );

                            if (severityCompare != 0) {
                                return severityCompare;
                            }

                            return first
                                    .stableKey()
                                    .compareTo(
                                            second.stableKey()
                                    );
                        }
                )
                .toList();
    }

    private BoardExceptionResponse exception(
            String stableKey,
            BoardExceptionType type,
            BoardExceptionSeverity severity,
            String title,
            String detail,
            int occurrenceCount,
            BigDecimal metricValue,
            String sourceRoute
    ) {
        return new BoardExceptionResponse(
                stableKey,
                type,
                severity,
                title,
                detail,
                occurrenceCount,
                mathService
                        .decimal(
                                metricValue
                        ),
                sourceRoute
        );
    }

    private int severityRank(
            BoardExceptionSeverity severity
    ) {
        return switch (
                severity
        ) {
            case CRITICAL -> 1;
            case HIGH -> 2;
            case MEDIUM -> 3;
            case INFO -> 4;
        };
    }

    private String generatedSummary(
            BigDecimal overall,
            BoardHealth health,
            BigDecimal objectiveExecution,
            BigDecimal alignment,
            BigDecimal capacity,
            BigDecimal capability,
            BigDecimal succession,
            List<BoardExceptionResponse> exceptions
    ) {
        String pressure =
                exceptions.isEmpty()
                        ? "No governed strategic exception is currently active."
                        : "Highest-priority exception: "
                        + exceptions
                                .getFirst()
                                .title()
                        + ".";

        return "Procurement strategy execution is "
                + health.name()
                + " at "
                + overall.setScale(
                        1,
                        RoundingMode.HALF_UP
                )
                + "/100. Objective execution "
                + objectiveExecution.setScale(
                        1,
                        RoundingMode.HALF_UP
                )
                + ", strategic alignment "
                + alignment.setScale(
                        1,
                        RoundingMode.HALF_UP
                )
                + ", capacity "
                + capacity.setScale(
                        1,
                        RoundingMode.HALF_UP
                )
                + ", capability "
                + capability.setScale(
                        1,
                        RoundingMode.HALF_UP
                )
                + ", succession resilience "
                + succession.setScale(
                        1,
                        RoundingMode.HALF_UP
                )
                + ". "
                + pressure;
    }

    private String label(
            BoardDimensionKey key
    ) {
        return switch (
                key
        ) {
            case OBJECTIVE_EXECUTION ->
                    "Objective execution";

            case STRATEGIC_ALIGNMENT ->
                    "Strategic alignment";

            case CAPACITY_READINESS ->
                    "Capacity readiness";

            case CAPABILITY_READINESS ->
                    "Capability readiness";

            case SUCCESSION_RESILIENCE ->
                    "Succession resilience";
        };
    }

    private String sourceDetail(
            BoardDimensionKey key,
            StrategicAlignmentDashboardResponse alignment,
            CapacityPlanningDashboardResponse capacity,
            CapabilityPlanningDashboardResponse capability,
            SuccessionPlanningDashboardResponse succession
    ) {
        return switch (
                key
        ) {
            case OBJECTIVE_EXECUTION ->
                    alignment
                            .objectives()
                            .size()
                    + " governed objective(s); "
                    + alignment
                            .objectives()
                            .stream()
                            .filter(
                                    objective ->
                                            objective
                                                    .okrHealth()
                                                    .name()
                                                    .equals(
                                                            "OFF_TRACK"
                                                    )
                            )
                            .count()
                    + " off track.";

            case STRATEGIC_ALIGNMENT ->
                    alignment
                            .summary()
                            .alignedSourceCount()
                    + " aligned / "
                    + alignment
                            .summary()
                            .candidateSourceCount()
                    + " strategic work item(s); "
                    + alignment
                            .summary()
                            .deadlineConflictCount()
                    + " deadline conflict(s).";

            case CAPACITY_READINESS ->
                    capacity
                            .summary()
                            .effectiveCapacityHours()
                            .setScale(
                                    0,
                                    RoundingMode.HALF_UP
                            )
                    + " effective hours versus "
                    + capacity
                            .summary()
                            .estimatedDemandHours()
                            .setScale(
                                    0,
                                    RoundingMode.HALF_UP
                            )
                    + " estimated demand hours.";

            case CAPABILITY_READINESS ->
                    capability
                            .summary()
                            .criticalGapCount()
                    + " critical capability gap(s); "
                    + capability
                            .summary()
                            .workWithRequirementsCount()
                    + " / "
                    + capability
                            .summary()
                            .strategicWorkCount()
                    + " work item(s) have governed requirements.";

            case SUCCESSION_RESILIENCE ->
                    succession
                            .summary()
                            .singlePointFailureCount()
                    + " single-point-of-failure exposure(s); "
                    + succession
                            .summary()
                            .readyCandidateCount()
                    + " ready succession candidate(s).";
        };
    }

    private BoardSnapshotSummaryResponse snapshotSummary(
            StrategyCockpitRepository.SnapshotRow row
    ) {
        return new BoardSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.currency(),
                row.fiscalYear(),
                mathService
                        .boundedScore(
                                row.overallScore()
                        ),
                row.overallHealth(),
                mathService
                        .decimal(
                                row.scoreDelta()
                        ),
                row.movement(),
                row.exceptionCount(),
                row.criticalExceptionCount(),
                row.boardCommentary(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private BoardScorecardSummaryResponse summaryFromSnapshot(
            StrategyCockpitRepository.SnapshotRow row
    ) {
        return new BoardScorecardSummaryResponse(
                row.currency(),
                row.fiscalYear(),
                mathService
                        .boundedScore(
                                row.objectiveExecutionScore()
                        ),
                mathService
                        .boundedScore(
                                row.strategicAlignmentScore()
                        ),
                mathService
                        .boundedScore(
                                row.capacityScore()
                        ),
                mathService
                        .boundedScore(
                                row.capabilityScore()
                        ),
                mathService
                        .boundedScore(
                                row.successionScore()
                        ),
                mathService
                        .boundedScore(
                                row.overallScore()
                        ),
                row.overallHealth(),
                row.previousOverallScore(),
                mathService
                        .decimal(
                                row.scoreDelta()
                        ),
                row.movement(),
                row.strategicObjectiveCount(),
                row.offTrackObjectiveCount(),
                row.unalignedWorkCount(),
                row.overloadedMemberCount(),
                row.criticalCapabilityGapCount(),
                row.successionSpofCount(),
                row.exceptionCount(),
                row.criticalExceptionCount(),
                row.generatedSummary()
        );
    }

    private BoardDimensionResponse dimensionResponse(
            StrategyCockpitRepository.DimensionRow row
    ) {
        return new BoardDimensionResponse(
                row.key(),
                row.label(),
                mathService
                        .decimal(
                                row.weightPct()
                        ),
                mathService
                        .boundedScore(
                                row.score()
                        ),
                mathService
                        .decimal(
                                row.weightedContribution()
                        ),
                row.health(),
                row.previousScore(),
                mathService
                        .decimal(
                                row.scoreDelta()
                        ),
                row.sourceDetail()
        );
    }

    private BoardExceptionResponse exceptionResponse(
            StrategyCockpitRepository.ExceptionRow row
    ) {
        return new BoardExceptionResponse(
                row.stableKey(),
                row.type(),
                row.severity(),
                row.title(),
                row.detail(),
                row.occurrenceCount(),
                mathService
                        .decimal(
                                row.metricValue()
                        ),
                row.sourceRoute()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "BOARD-%d-%05d",
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
                    "Strategy-cockpit currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
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
                    "Your ProcureIQ role cannot access the enterprise strategy cockpit."
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
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can capture board scorecard packs."
            );
        }
    }

    private record LiveBoard(
            BoardScorecardSummaryResponse summary,
            List<BoardDimensionResponse> dimensions,
            List<BoardExceptionResponse> exceptions
    ) {
    }
}
