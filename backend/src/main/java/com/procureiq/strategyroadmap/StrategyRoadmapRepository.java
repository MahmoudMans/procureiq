package com.procureiq.strategyroadmap;

import com.procureiq.capacityplanning.CapacityUserOptionResponse;
import com.procureiq.strategycockpit.BoardDimensionKey;
import com.procureiq.user.ProcurementRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class StrategyRoadmapRepository {

    private final JdbcTemplate jdbcTemplate;

    public StrategyRoadmapRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextRoadmapSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategy_roadmap_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextInitiativeSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategy_roadmap_initiative_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategy_roadmap_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<CapacityUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role

                FROM app_users

                WHERE active =
                    TRUE

                AND role
                    <> 'REQUESTER'

                ORDER BY
                    full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CapacityUserOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "full_name"
                                ),
                                ProcurementRole.valueOf(
                                        resultSet.getString(
                                                "role"
                                        )
                                )
                        )
        );
    }

    public void createRoadmap(
            UUID roadmapId,
            String roadmapNumber,
            UUID scenarioId,
            String scenarioNumber,
            String scenarioName,
            UUID evaluationId,
            String evaluationNumber,
            String currency,
            int fiscalYear,
            StrategyRoadmapInput input,
            BigDecimal baselineScore,
            BigDecimal simulatedScore,
            BigDecimal delta,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_roadmaps (
                    id,
                    roadmap_number,
                    source_scenario_id,
                    source_scenario_number,
                    source_scenario_name,
                    source_evaluation_id,
                    source_evaluation_number,
                    currency,
                    fiscal_year,
                    title,
                    objective,
                    start_date,
                    target_end_date,
                    status,
                    scenario_baseline_score,
                    scenario_simulated_score,
                    scenario_delta,
                    created_by_user_id,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'DRAFT',
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                roadmapId,
                roadmapNumber,
                scenarioId,
                scenarioNumber,
                scenarioName,
                evaluationId,
                evaluationNumber,
                currency,
                fiscalYear,
                input.title()
                        .trim(),
                input.objective()
                        .trim(),
                input.startDate(),
                input.targetEndDate(),
                baselineScore,
                simulatedScore,
                delta,
                currentUserId
        );
    }

    public RoadmapRow findRoadmap(
            UUID roadmapId
    ) {
        return jdbcTemplate.query(
                roadmapSql()
                        + """
                        WHERE roadmap.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRoadmap(
                                resultSet
                        ),
                roadmapId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<RoadmapRow> roadmaps() {
        return jdbcTemplate.query(
                roadmapSql()
                        + """
                        ORDER BY
                            CASE roadmap.status
                                WHEN 'ACTIVE'
                                THEN 1
                                WHEN 'ON_HOLD'
                                THEN 2
                                WHEN 'DRAFT'
                                THEN 3
                                WHEN 'COMPLETED'
                                THEN 4
                                ELSE 5
                            END,
                            roadmap.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRoadmap(
                                resultSet
                        )
        );
    }

    public void activateRoadmap(
            UUID roadmapId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_roadmaps

                SET
                    status =
                        'ACTIVE',

                    activated_at =
                        COALESCE(
                            activated_at,
                            CURRENT_TIMESTAMP
                        ),

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status IN (
                    'DRAFT',
                    'ON_HOLD'
                )
                """,
                roadmapId
        );
    }

    public void holdRoadmap(
            UUID roadmapId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_roadmaps

                SET
                    status =
                        'ON_HOLD',

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'ACTIVE'
                """,
                roadmapId
        );
    }

    public void completeRoadmap(
            UUID roadmapId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_roadmaps

                SET
                    status =
                        'COMPLETED',

                    completed_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status IN (
                    'ACTIVE',
                    'ON_HOLD'
                )
                """,
                roadmapId
        );
    }

    public void archiveRoadmap(
            UUID roadmapId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_roadmaps

                SET
                    status =
                        'ARCHIVED',

                    archived_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status
                    <> 'ARCHIVED'
                """,
                roadmapId
        );
    }

    public void createInitiative(
            UUID initiativeId,
            UUID roadmapId,
            String initiativeNumber,
            RoadmapInitiativeInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_roadmap_initiatives (
                    id,
                    roadmap_id,
                    initiative_number,
                    title,
                    description,
                    dimension_key,
                    priority,
                    owner_user_id,
                    planned_start_date,
                    planned_end_date,
                    planned_contribution_points,
                    status,
                    created_by_user_id,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'PLANNED',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                initiativeId,
                roadmapId,
                initiativeNumber,
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                input.dimensionKey()
                        .name(),
                input.priority()
                        .name(),
                input.ownerUserId(),
                input.plannedStartDate(),
                input.plannedEndDate(),
                input.plannedContributionPoints(),
                currentUserId
        );
    }

    public InitiativeRow findInitiative(
            UUID initiativeId
    ) {
        return jdbcTemplate.query(
                initiativeSql()
                        + """
                        WHERE initiative.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapInitiative(
                                resultSet
                        ),
                initiativeId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<InitiativeRow> initiatives(
            UUID roadmapId
    ) {
        return jdbcTemplate.query(
                initiativeSql()
                        + """
                        WHERE initiative.roadmap_id = ?

                        ORDER BY
                            CASE initiative.priority
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                WHEN 'MEDIUM'
                                THEN 3
                                ELSE 4
                            END,
                            initiative.planned_start_date,
                            initiative.initiative_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapInitiative(
                                resultSet
                        ),
                roadmapId
        );
    }

    public void startInitiative(
            UUID initiativeId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_roadmap_initiatives

                SET
                    status =
                        'IN_PROGRESS',

                    started_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'PLANNED'
                """,
                initiativeId
        );
    }

    public void completeInitiative(
            UUID initiativeId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_roadmap_initiatives

                SET
                    status =
                        'COMPLETED',

                    completed_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'IN_PROGRESS'
                """,
                initiativeId
        );
    }

    public void cancelInitiative(
            UUID initiativeId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_roadmap_initiatives

                SET
                    status =
                        'CANCELLED',

                    cancelled_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status IN (
                    'PLANNED',
                    'IN_PROGRESS'
                )
                """,
                initiativeId
        );
    }

    public void createDependency(
            UUID dependencyId,
            UUID roadmapId,
            RoadmapDependencyInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_roadmap_dependencies (
                    id,
                    roadmap_id,
                    predecessor_initiative_id,
                    successor_initiative_id,
                    dependency_type,
                    rationale,
                    created_by_user_id,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                dependencyId,
                roadmapId,
                input.predecessorInitiativeId(),
                input.successorInitiativeId(),
                input.dependencyType()
                        .name(),
                normalizeOptional(
                        input.rationale()
                ),
                currentUserId
        );
    }

    public DependencyRow findDependency(
            UUID dependencyId
    ) {
        return jdbcTemplate.query(
                dependencySql()
                        + """
                        WHERE dependency.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDependency(
                                resultSet
                        ),
                dependencyId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<DependencyRow> dependencies(
            UUID roadmapId
    ) {
        return jdbcTemplate.query(
                dependencySql()
                        + """
                        WHERE dependency.roadmap_id = ?

                        ORDER BY
                            predecessor.initiative_number,
                            successor.initiative_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDependency(
                                resultSet
                        ),
                roadmapId
        );
    }

    public void deleteDependency(
            UUID dependencyId
    ) {
        jdbcTemplate.update(
                """
                DELETE FROM procurement_strategy_roadmap_dependencies
                WHERE id = ?
                """,
                dependencyId
        );
    }

    public void createMilestone(
            UUID milestoneId,
            UUID initiativeId,
            RoadmapMilestoneInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_roadmap_milestones (
                    id,
                    initiative_id,
                    title,
                    description,
                    due_date,
                    status,
                    created_by_user_id,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'PLANNED',
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                milestoneId,
                initiativeId,
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                input.dueDate(),
                currentUserId
        );
    }

    public MilestoneRow findMilestone(
            UUID milestoneId
    ) {
        return jdbcTemplate.query(
                milestoneSql()
                        + """
                        WHERE milestone.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapMilestone(
                                resultSet
                        ),
                milestoneId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<MilestoneRow> milestones(
            UUID roadmapId
    ) {
        return jdbcTemplate.query(
                milestoneSql()
                        + """
                        WHERE initiative.roadmap_id = ?

                        ORDER BY
                            milestone.due_date,
                            milestone.title
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapMilestone(
                                resultSet
                        ),
                roadmapId
        );
    }

    public void completeMilestone(
            UUID milestoneId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_roadmap_milestones

                SET
                    status =
                        'COMPLETED',

                    completed_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?
                AND status =
                    'PLANNED'
                """,
                milestoneId
        );
    }

    public void cancelMilestone(
            UUID milestoneId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_roadmap_milestones

                SET
                    status =
                        'CANCELLED',

                    cancelled_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?
                AND status =
                    'PLANNED'
                """,
                milestoneId
        );
    }

    public void createGate(
            UUID gateId,
            UUID initiativeId,
            RoadmapGateInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_roadmap_gates (
                    id,
                    initiative_id,
                    gate_name,
                    due_date,
                    status,
                    created_by_user_id,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    'PENDING',
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                gateId,
                initiativeId,
                input.gateName()
                        .trim(),
                input.dueDate(),
                currentUserId
        );
    }

    public GateRow findGate(
            UUID gateId
    ) {
        return jdbcTemplate.query(
                gateSql()
                        + """
                        WHERE gate.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapGate(
                                resultSet
                        ),
                gateId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<GateRow> gates(
            UUID roadmapId
    ) {
        return jdbcTemplate.query(
                gateSql()
                        + """
                        WHERE initiative.roadmap_id = ?

                        ORDER BY
                            gate.due_date,
                            gate.gate_name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapGate(
                                resultSet
                        ),
                roadmapId
        );
    }

    public void decideGate(
            UUID gateId,
            RoadmapGateStatus decision,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_roadmap_gates

                SET
                    status = ?,
                    decision_note = ?,
                    decided_by_user_id = ?,
                    decided_at =
                        CURRENT_TIMESTAMP

                WHERE id = ?
                AND status =
                    'PENDING'
                """,
                decision.name(),
                note.trim(),
                currentUserId,
                gateId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            StrategyRoadmapSummaryResponse roadmap,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_roadmap_snapshots (
                    id,
                    snapshot_number,
                    roadmap_id,
                    roadmap_number,
                    roadmap_title,
                    roadmap_status,
                    initiative_count,
                    completed_initiative_count,
                    blocked_initiative_count,
                    overdue_milestone_count,
                    rejected_gate_count,
                    owner_coverage_pct,
                    dependency_health_pct,
                    milestone_health_pct,
                    gate_health_pct,
                    readiness_score,
                    readiness_health,
                    captured_by_user_id,
                    captured_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,
                roadmap.id(),
                roadmap.roadmapNumber(),
                roadmap.title(),
                roadmap.status()
                        .name(),
                roadmap.initiativeCount(),
                roadmap.completedInitiativeCount(),
                roadmap.blockedInitiativeCount(),
                roadmap.overdueMilestoneCount(),
                roadmap.rejectedGateCount(),
                roadmap.ownerCoveragePct(),
                roadmap.dependencyHealthPct(),
                roadmap.milestoneHealthPct(),
                roadmap.gateHealthPct(),
                roadmap.readinessScore(),
                roadmap.readinessHealth()
                        .name(),
                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            RoadmapInitiativeResponse initiative
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_roadmap_snapshot_items (
                    id,
                    snapshot_id,
                    initiative_id,
                    initiative_number,
                    title,
                    dimension_key,
                    priority,
                    owner_name,
                    planned_start_date,
                    planned_end_date,
                    planned_contribution_points,
                    status,
                    blocked_dependency_count,
                    overdue_milestone_count,
                    pending_gate_count,
                    rejected_gate_count,
                    blocked,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                initiative.id(),
                initiative.initiativeNumber(),
                initiative.title(),
                initiative.dimensionKey()
                        .name(),
                initiative.priority()
                        .name(),
                initiative.ownerName(),
                initiative.plannedStartDate(),
                initiative.plannedEndDate(),
                initiative.plannedContributionPoints(),
                initiative.status()
                        .name(),
                initiative.blockedDependencyCount(),
                initiative.overdueMilestoneCount(),
                initiative.pendingGateCount(),
                initiative.rejectedGateCount(),
                initiative.blocked()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE snapshot.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        ),
                snapshotId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<SnapshotRow> snapshots(
            UUID roadmapId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE snapshot.roadmap_id = ?

                        ORDER BY
                            snapshot.captured_at DESC

                        LIMIT 100
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        ),
                roadmapId
        );
    }

    public List<SnapshotItemRow> snapshotItems(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    initiative_id,
                    initiative_number,
                    title,
                    dimension_key,
                    priority,
                    owner_name,
                    planned_start_date,
                    planned_end_date,
                    planned_contribution_points,
                    status,
                    blocked_dependency_count,
                    overdue_milestone_count,
                    pending_gate_count,
                    rejected_gate_count,
                    blocked

                FROM procurement_strategy_roadmap_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    CASE priority
                        WHEN 'CRITICAL'
                        THEN 1
                        WHEN 'HIGH'
                        THEN 2
                        WHEN 'MEDIUM'
                        THEN 3
                        ELSE 4
                    END,
                    planned_start_date,
                    initiative_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "initiative_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "initiative_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                BoardDimensionKey.valueOf(
                                        resultSet.getString(
                                                "dimension_key"
                                        )
                                ),
                                RoadmapPriority.valueOf(
                                        resultSet.getString(
                                                "priority"
                                        )
                                ),
                                resultSet.getString(
                                        "owner_name"
                                ),
                                resultSet.getObject(
                                        "planned_start_date",
                                        LocalDate.class
                                ),
                                resultSet.getObject(
                                        "planned_end_date",
                                        LocalDate.class
                                ),
                                resultSet.getBigDecimal(
                                        "planned_contribution_points"
                                ),
                                RoadmapInitiativeStatus.valueOf(
                                        resultSet.getString(
                                                "status"
                                        )
                                ),
                                resultSet.getInt(
                                        "blocked_dependency_count"
                                ),
                                resultSet.getInt(
                                        "overdue_milestone_count"
                                ),
                                resultSet.getInt(
                                        "pending_gate_count"
                                ),
                                resultSet.getInt(
                                        "rejected_gate_count"
                                ),
                                resultSet.getBoolean(
                                        "blocked"
                                )
                        ),
                snapshotId
        );
    }

    private String roadmapSql() {
        return """
                SELECT
                    roadmap.id,
                    roadmap.roadmap_number,
                    roadmap.source_scenario_id,
                    roadmap.source_scenario_number,
                    roadmap.source_scenario_name,
                    roadmap.source_evaluation_id,
                    roadmap.source_evaluation_number,
                    roadmap.currency,
                    roadmap.fiscal_year,
                    roadmap.title,
                    roadmap.objective,
                    roadmap.start_date,
                    roadmap.target_end_date,
                    roadmap.status,
                    roadmap.scenario_baseline_score,
                    roadmap.scenario_simulated_score,
                    roadmap.scenario_delta,

                    creator.full_name
                        AS created_by_name,

                    roadmap.created_at,
                    roadmap.updated_at,
                    roadmap.version

                FROM procurement_strategy_roadmaps
                    roadmap

                JOIN app_users
                    creator
                    ON creator.id =
                       roadmap.created_by_user_id

                """;
    }

    private String initiativeSql() {
        return """
                SELECT
                    initiative.id,
                    initiative.roadmap_id,
                    initiative.initiative_number,
                    initiative.title,
                    initiative.description,
                    initiative.dimension_key,
                    initiative.priority,
                    initiative.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    owner.role
                        AS owner_role,

                    initiative.planned_start_date,
                    initiative.planned_end_date,
                    initiative.planned_contribution_points,
                    initiative.status,
                    initiative.created_at,
                    initiative.updated_at,
                    initiative.version

                FROM procurement_strategy_roadmap_initiatives
                    initiative

                JOIN app_users
                    owner
                    ON owner.id =
                       initiative.owner_user_id

                """;
    }

    private String dependencySql() {
        return """
                SELECT
                    dependency.id,
                    dependency.roadmap_id,
                    dependency.predecessor_initiative_id,

                    predecessor.initiative_number
                        AS predecessor_number,

                    predecessor.title
                        AS predecessor_title,

                    predecessor.status
                        AS predecessor_status,

                    dependency.successor_initiative_id,

                    successor.initiative_number
                        AS successor_number,

                    successor.title
                        AS successor_title,

                    successor.status
                        AS successor_status,

                    dependency.dependency_type,
                    dependency.rationale

                FROM procurement_strategy_roadmap_dependencies
                    dependency

                JOIN procurement_strategy_roadmap_initiatives
                    predecessor
                    ON predecessor.id =
                       dependency.predecessor_initiative_id

                JOIN procurement_strategy_roadmap_initiatives
                    successor
                    ON successor.id =
                       dependency.successor_initiative_id

                """;
    }

    private String milestoneSql() {
        return """
                SELECT
                    milestone.id,
                    milestone.initiative_id,
                    initiative.roadmap_id,
                    milestone.title,
                    milestone.description,
                    milestone.due_date,
                    milestone.status

                FROM procurement_strategy_roadmap_milestones
                    milestone

                JOIN procurement_strategy_roadmap_initiatives
                    initiative
                    ON initiative.id =
                       milestone.initiative_id

                """;
    }

    private String gateSql() {
        return """
                SELECT
                    gate.id,
                    gate.initiative_id,
                    initiative.roadmap_id,
                    gate.gate_name,
                    gate.due_date,
                    gate.status,
                    gate.decision_note,

                    decider.full_name
                        AS decided_by_name

                FROM procurement_strategy_roadmap_gates
                    gate

                JOIN procurement_strategy_roadmap_initiatives
                    initiative
                    ON initiative.id =
                       gate.initiative_id

                LEFT JOIN app_users
                    decider
                    ON decider.id =
                       gate.decided_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    snapshot.id,
                    snapshot.snapshot_number,
                    snapshot.roadmap_id,
                    snapshot.roadmap_number,
                    snapshot.roadmap_title,
                    snapshot.roadmap_status,
                    snapshot.initiative_count,
                    snapshot.completed_initiative_count,
                    snapshot.blocked_initiative_count,
                    snapshot.overdue_milestone_count,
                    snapshot.rejected_gate_count,
                    snapshot.owner_coverage_pct,
                    snapshot.dependency_health_pct,
                    snapshot.milestone_health_pct,
                    snapshot.gate_health_pct,
                    snapshot.readiness_score,
                    snapshot.readiness_health,

                    user_account.full_name
                        AS captured_by_name,

                    snapshot.captured_at

                FROM procurement_strategy_roadmap_snapshots
                    snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       snapshot.captured_by_user_id

                """;
    }

    private RoadmapRow mapRoadmap(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new RoadmapRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "roadmap_number"
                ),
                resultSet.getObject(
                        "source_scenario_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_scenario_number"
                ),
                resultSet.getString(
                        "source_scenario_name"
                ),
                resultSet.getObject(
                        "source_evaluation_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_evaluation_number"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "objective"
                ),
                resultSet.getObject(
                        "start_date",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "target_end_date",
                        LocalDate.class
                ),
                StrategyRoadmapStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getBigDecimal(
                        "scenario_baseline_score"
                ),
                resultSet.getBigDecimal(
                        "scenario_simulated_score"
                ),
                resultSet.getBigDecimal(
                        "scenario_delta"
                ),
                resultSet.getString(
                        "created_by_name"
                ),
                resultSet.getTimestamp(
                        "created_at"
                )
                        .toInstant(),
                resultSet.getTimestamp(
                        "updated_at"
                )
                        .toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private InitiativeRow mapInitiative(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new InitiativeRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "roadmap_id",
                        UUID.class
                ),
                resultSet.getString(
                        "initiative_number"
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
                ),
                BoardDimensionKey.valueOf(
                        resultSet.getString(
                                "dimension_key"
                        )
                ),
                RoadmapPriority.valueOf(
                        resultSet.getString(
                                "priority"
                        )
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getString(
                        "owner_role"
                ),
                resultSet.getObject(
                        "planned_start_date",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "planned_end_date",
                        LocalDate.class
                ),
                resultSet.getBigDecimal(
                        "planned_contribution_points"
                ),
                RoadmapInitiativeStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private DependencyRow mapDependency(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new DependencyRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "roadmap_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "predecessor_initiative_id",
                        UUID.class
                ),
                resultSet.getString(
                        "predecessor_number"
                ),
                resultSet.getString(
                        "predecessor_title"
                ),
                RoadmapInitiativeStatus.valueOf(
                        resultSet.getString(
                                "predecessor_status"
                        )
                ),
                resultSet.getObject(
                        "successor_initiative_id",
                        UUID.class
                ),
                resultSet.getString(
                        "successor_number"
                ),
                resultSet.getString(
                        "successor_title"
                ),
                RoadmapInitiativeStatus.valueOf(
                        resultSet.getString(
                                "successor_status"
                        )
                ),
                RoadmapDependencyType.valueOf(
                        resultSet.getString(
                                "dependency_type"
                        )
                ),
                resultSet.getString(
                        "rationale"
                )
        );
    }

    private MilestoneRow mapMilestone(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new MilestoneRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "initiative_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "roadmap_id",
                        UUID.class
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                RoadmapMilestoneStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                )
        );
    }

    private GateRow mapGate(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new GateRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "initiative_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "roadmap_id",
                        UUID.class
                ),
                resultSet.getString(
                        "gate_name"
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                RoadmapGateStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "decision_note"
                ),
                resultSet.getString(
                        "decided_by_name"
                )
        );
    }

    private SnapshotRow mapSnapshot(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new SnapshotRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "snapshot_number"
                ),
                resultSet.getObject(
                        "roadmap_id",
                        UUID.class
                ),
                resultSet.getString(
                        "roadmap_number"
                ),
                resultSet.getString(
                        "roadmap_title"
                ),
                StrategyRoadmapStatus.valueOf(
                        resultSet.getString(
                                "roadmap_status"
                        )
                ),
                resultSet.getInt(
                        "initiative_count"
                ),
                resultSet.getInt(
                        "completed_initiative_count"
                ),
                resultSet.getInt(
                        "blocked_initiative_count"
                ),
                resultSet.getInt(
                        "overdue_milestone_count"
                ),
                resultSet.getInt(
                        "rejected_gate_count"
                ),
                resultSet.getBigDecimal(
                        "owner_coverage_pct"
                ),
                resultSet.getBigDecimal(
                        "dependency_health_pct"
                ),
                resultSet.getBigDecimal(
                        "milestone_health_pct"
                ),
                resultSet.getBigDecimal(
                        "gate_health_pct"
                ),
                resultSet.getBigDecimal(
                        "readiness_score"
                ),
                RoadmapReadinessHealth.valueOf(
                        resultSet.getString(
                                "readiness_health"
                        )
                ),
                resultSet.getString(
                        "captured_by_name"
                ),
                resultSet.getTimestamp(
                        "captured_at"
                )
                        .toInstant()
        );
    }

    private String normalizeOptional(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String normalized =
                value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }

    public record RoadmapRow(
            UUID id,
            String roadmapNumber,
            UUID sourceScenarioId,
            String sourceScenarioNumber,
            String sourceScenarioName,
            UUID sourceEvaluationId,
            String sourceEvaluationNumber,
            String currency,
            int fiscalYear,
            String title,
            String objective,
            LocalDate startDate,
            LocalDate targetEndDate,
            StrategyRoadmapStatus status,
            BigDecimal scenarioBaselineScore,
            BigDecimal scenarioSimulatedScore,
            BigDecimal scenarioDelta,
            String createdByName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record InitiativeRow(
            UUID id,
            UUID roadmapId,
            String initiativeNumber,
            String title,
            String description,
            BoardDimensionKey dimensionKey,
            RoadmapPriority priority,
            UUID ownerUserId,
            String ownerName,
            String ownerRole,
            LocalDate plannedStartDate,
            LocalDate plannedEndDate,
            BigDecimal plannedContributionPoints,
            RoadmapInitiativeStatus status,
            long version
    ) {
    }

    public record DependencyRow(
            UUID id,
            UUID roadmapId,
            UUID predecessorInitiativeId,
            String predecessorNumber,
            String predecessorTitle,
            RoadmapInitiativeStatus predecessorStatus,
            UUID successorInitiativeId,
            String successorNumber,
            String successorTitle,
            RoadmapInitiativeStatus successorStatus,
            RoadmapDependencyType dependencyType,
            String rationale
    ) {
    }

    public record MilestoneRow(
            UUID id,
            UUID initiativeId,
            UUID roadmapId,
            String title,
            String description,
            LocalDate dueDate,
            RoadmapMilestoneStatus status
    ) {
    }

    public record GateRow(
            UUID id,
            UUID initiativeId,
            UUID roadmapId,
            String gateName,
            LocalDate dueDate,
            RoadmapGateStatus status,
            String decisionNote,
            String decidedByName
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            UUID roadmapId,
            String roadmapNumber,
            String roadmapTitle,
            StrategyRoadmapStatus roadmapStatus,
            int initiativeCount,
            int completedInitiativeCount,
            int blockedInitiativeCount,
            int overdueMilestoneCount,
            int rejectedGateCount,
            BigDecimal ownerCoveragePct,
            BigDecimal dependencyHealthPct,
            BigDecimal milestoneHealthPct,
            BigDecimal gateHealthPct,
            BigDecimal readinessScore,
            RoadmapReadinessHealth readinessHealth,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID initiativeId,
            String initiativeNumber,
            String title,
            BoardDimensionKey dimensionKey,
            RoadmapPriority priority,
            String ownerName,
            LocalDate plannedStartDate,
            LocalDate plannedEndDate,
            BigDecimal plannedContributionPoints,
            RoadmapInitiativeStatus status,
            int blockedDependencyCount,
            int overdueMilestoneCount,
            int pendingGateCount,
            int rejectedGateCount,
            boolean blocked
    ) {
    }
}
