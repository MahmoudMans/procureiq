package com.procureiq.continuousimprovement;

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
public class ContinuousImprovementRepository {

    private final JdbcTemplate jdbcTemplate;

    public ContinuousImprovementRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextInitiativeSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_improvement_initiative_number_seq'
                )
                """,
                Long.class
        );
    }

    public SnapshotRow latestSnapshot(
            String currency
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE snapshot.currency = ?

                        ORDER BY
                            snapshot.captured_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        ),
                currency
        )
                .stream()
                .findFirst()
                .orElse(null);
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
            String currency
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE snapshot.currency = ?

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
                currency
        );
    }

    public List<DimensionRow> dimensions(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    snapshot_id,
                    dimension_type,
                    dimension_key,
                    dimension_label,
                    active_count,
                    sla_overdue_count,
                    persistent_count,
                    resolved_count,
                    on_time_resolved_count,
                    sla_attainment_pct,
                    avg_resolution_hours,
                    avg_active_age_days,
                    active_exposure,
                    workload_share_pct

                FROM procurement_operating_rhythm_dimensions

                WHERE snapshot_id = ?

                ORDER BY
                    CASE dimension_type
                        WHEN 'DOMAIN'
                        THEN 1
                        WHEN 'OWNER'
                        THEN 2
                        WHEN 'SEVERITY'
                        THEN 3
                        ELSE 4
                    END,

                    active_count DESC,
                    dimension_label
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDimension(
                                resultSet
                        ),
                snapshotId
        );
    }

    public DimensionRow findDimension(
            UUID snapshotId,
            ImprovementScopeType scopeType,
            String scopeKey
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    snapshot_id,
                    dimension_type,
                    dimension_key,
                    dimension_label,
                    active_count,
                    sla_overdue_count,
                    persistent_count,
                    resolved_count,
                    on_time_resolved_count,
                    sla_attainment_pct,
                    avg_resolution_hours,
                    avg_active_age_days,
                    active_exposure,
                    workload_share_pct

                FROM procurement_operating_rhythm_dimensions

                WHERE snapshot_id = ?
                AND dimension_type = ?
                AND dimension_key = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDimension(
                                resultSet
                        ),
                snapshotId,
                scopeType.name(),
                scopeKey
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void createInitiative(
            UUID initiativeId,
            String initiativeNumber,
            ImprovementInitiativeInput input,
            SnapshotRow snapshot,
            String scopeKey,
            String scopeLabel,
            UUID ownerUserId,
            ImprovementMetricVector baseline
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_improvement_initiatives (
                    id,
                    initiative_number,
                    title,
                    description,
                    currency,
                    priority,
                    status,
                    owner_user_id,
                    source_snapshot_id,
                    scope_type,
                    scope_key,
                    scope_label,
                    baseline_active_count,
                    baseline_sla_overdue_count,
                    baseline_persistent_count,
                    baseline_resolved_count,
                    baseline_sla_attainment_pct,
                    baseline_avg_resolution_hours,
                    baseline_avg_active_age_days,
                    baseline_active_exposure,
                    target_sla_attainment_pct,
                    target_sla_overdue_reduction_pct,
                    target_persistent_reduction_pct,
                    target_resolution_hours_reduction_pct,
                    target_exposure_reduction_pct,
                    target_date,
                    notes,
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
                    'DRAFT',
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
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                initiativeId,
                initiativeNumber,
                input.title()
                        .trim(),
                input.description()
                        .trim(),
                snapshot.currency(),
                input.priority()
                        .name(),
                ownerUserId,
                snapshot.id(),
                input.scopeType()
                        .name(),
                scopeKey,
                scopeLabel,
                baseline.activeCount(),
                baseline.slaOverdueCount(),
                baseline.persistentCount(),
                baseline.resolvedCount(),
                baseline.slaAttainmentPct(),
                baseline.avgResolutionHours(),
                baseline.avgActiveAgeDays(),
                baseline.activeExposure(),
                input.targetSlaAttainmentPct(),
                input.targetSlaOverdueReductionPct(),
                input.targetPersistentReductionPct(),
                input.targetResolutionHoursReductionPct(),
                input.targetExposureReductionPct(),
                input.targetDate(),
                normalizeOptional(
                        input.notes()
                )
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
            String currency
    ) {
        return jdbcTemplate.query(
                initiativeSql()
                        + """
                        WHERE initiative.currency = ?

                        ORDER BY
                            CASE initiative.status
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

                            CASE initiative.priority
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                WHEN 'MEDIUM'
                                THEN 3
                                ELSE 4
                            END,

                            initiative.target_date,
                            initiative.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapInitiative(
                                resultSet
                        ),
                currency
        );
    }

    public void startInitiative(
            UUID initiativeId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_improvement_initiatives
                SET
                    status =
                        'ACTIVE',
                    started_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'DRAFT'
                """,
                initiativeId
        );
    }

    public void holdInitiative(
            UUID initiativeId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_improvement_initiatives
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
                initiativeId
        );
    }

    public void resumeInitiative(
            UUID initiativeId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_improvement_initiatives
                SET
                    status =
                        'ACTIVE',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'ON_HOLD'
                """,
                initiativeId
        );
    }

    public void completeInitiative(
            UUID initiativeId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_improvement_initiatives
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
                initiativeId
        );
    }

    public void cancelInitiative(
            UUID initiativeId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_improvement_initiatives
                SET
                    status =
                        'CANCELLED',
                    notes =
                        CASE
                            WHEN notes IS NULL
                            OR BTRIM(notes) = ''
                            THEN ?

                            ELSE notes
                                 || E'\\n'
                                 || ?
                        END,
                    cancelled_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'DRAFT',
                    'ACTIVE',
                    'ON_HOLD'
                )
                """,
                "Cancellation: "
                        + note.trim(),
                "Cancellation: "
                        + note.trim(),
                initiativeId
        );
    }

    public void createAction(
            UUID actionId,
            UUID initiativeId,
            ImprovementActionInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_improvement_actions (
                    id,
                    initiative_id,
                    title,
                    description,
                    owner_user_id,
                    status,
                    due_date,
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
                    'PLANNED',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                actionId,
                initiativeId,
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                ownerUserId,
                input.dueDate()
        );
    }

    public ActionRow findAction(
            UUID actionId
    ) {
        return jdbcTemplate.query(
                actionSql()
                        + """
                        WHERE action.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAction(
                                resultSet
                        ),
                actionId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ActionRow> actions(
            UUID initiativeId
    ) {
        return jdbcTemplate.query(
                actionSql()
                        + """
                        WHERE action.initiative_id = ?

                        ORDER BY
                            CASE action.status
                                WHEN 'IN_PROGRESS'
                                THEN 1
                                WHEN 'PLANNED'
                                THEN 2
                                WHEN 'COMPLETED'
                                THEN 3
                                ELSE 4
                            END,

                            action.due_date,
                            action.created_at
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAction(
                                resultSet
                        ),
                initiativeId
        );
    }

    public void startAction(
            UUID actionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_improvement_actions
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
                actionId
        );
    }

    public void completeAction(
            UUID actionId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_improvement_actions
                SET
                    status =
                        'COMPLETED',
                    completion_note = ?,
                    completed_at =
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
                note.trim(),
                actionId
        );
    }

    public void cancelAction(
            UUID actionId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_improvement_actions
                SET
                    status =
                        'CANCELLED',
                    completion_note = ?,
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
                note.trim(),
                actionId
        );
    }

    public boolean checkpointExists(
            UUID initiativeId,
            UUID snapshotId
    ) {
        Boolean exists =
                jdbcTemplate.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM procurement_improvement_checkpoints
                            WHERE initiative_id = ?
                            AND snapshot_id = ?
                        )
                        """,
                        Boolean.class,
                        initiativeId,
                        snapshotId
                );

        return Boolean.TRUE.equals(
                exists
        );
    }

    public void createCheckpoint(
            UUID checkpointId,
            UUID initiativeId,
            UUID snapshotId,
            ImprovementMetricVector current,
            ImprovementEvaluation evaluation,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_improvement_checkpoints (
                    id,
                    initiative_id,
                    snapshot_id,
                    current_active_count,
                    current_sla_overdue_count,
                    current_persistent_count,
                    current_resolved_count,
                    current_sla_attainment_pct,
                    current_avg_resolution_hours,
                    current_avg_active_age_days,
                    current_active_exposure,
                    sla_attainment_delta,
                    sla_overdue_reduction_pct,
                    persistent_reduction_pct,
                    resolution_hours_reduction_pct,
                    exposure_reduction_pct,
                    targets_met_count,
                    achievement_score,
                    outcome,
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
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                checkpointId,
                initiativeId,
                snapshotId,
                current.activeCount(),
                current.slaOverdueCount(),
                current.persistentCount(),
                current.resolvedCount(),
                current.slaAttainmentPct(),
                current.avgResolutionHours(),
                current.avgActiveAgeDays(),
                current.activeExposure(),
                evaluation.slaAttainmentDelta(),
                evaluation.slaOverdueReductionPct(),
                evaluation.persistentReductionPct(),
                evaluation.resolutionHoursReductionPct(),
                evaluation.exposureReductionPct(),
                evaluation.targetsMetCount(),
                evaluation.achievementScore(),
                evaluation.outcome()
                        .name(),
                currentUserId
        );
    }

    public List<CheckpointRow> checkpoints(
            UUID initiativeId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    checkpoint.id,
                    checkpoint.snapshot_id,

                    snapshot.snapshot_number,

                    checkpoint.current_active_count,
                    checkpoint.current_sla_overdue_count,
                    checkpoint.current_persistent_count,
                    checkpoint.current_resolved_count,
                    checkpoint.current_sla_attainment_pct,
                    checkpoint.current_avg_resolution_hours,
                    checkpoint.current_avg_active_age_days,
                    checkpoint.current_active_exposure,

                    checkpoint.sla_attainment_delta,
                    checkpoint.sla_overdue_reduction_pct,
                    checkpoint.persistent_reduction_pct,
                    checkpoint.resolution_hours_reduction_pct,
                    checkpoint.exposure_reduction_pct,

                    checkpoint.targets_met_count,
                    checkpoint.achievement_score,
                    checkpoint.outcome,

                    user_account.full_name
                        AS captured_by_name,

                    checkpoint.captured_at

                FROM procurement_improvement_checkpoints
                    checkpoint

                JOIN procurement_operating_rhythm_snapshots
                    snapshot
                    ON snapshot.id =
                       checkpoint.snapshot_id

                JOIN app_users
                    user_account
                    ON user_account.id =
                       checkpoint.captured_by_user_id

                WHERE checkpoint.initiative_id = ?

                ORDER BY
                    checkpoint.captured_at DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CheckpointRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "snapshot_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "snapshot_number"
                                ),
                                resultSet.getLong(
                                        "current_active_count"
                                ),
                                resultSet.getLong(
                                        "current_sla_overdue_count"
                                ),
                                resultSet.getLong(
                                        "current_persistent_count"
                                ),
                                resultSet.getLong(
                                        "current_resolved_count"
                                ),
                                resultSet.getBigDecimal(
                                        "current_sla_attainment_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "current_avg_resolution_hours"
                                ),
                                resultSet.getBigDecimal(
                                        "current_avg_active_age_days"
                                ),
                                resultSet.getBigDecimal(
                                        "current_active_exposure"
                                ),
                                resultSet.getBigDecimal(
                                        "sla_attainment_delta"
                                ),
                                resultSet.getBigDecimal(
                                        "sla_overdue_reduction_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "persistent_reduction_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "resolution_hours_reduction_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "exposure_reduction_pct"
                                ),
                                resultSet.getInt(
                                        "targets_met_count"
                                ),
                                resultSet.getBigDecimal(
                                        "achievement_score"
                                ),
                                ImprovementOutcome.valueOf(
                                        resultSet.getString(
                                                "outcome"
                                        )
                                ),
                                resultSet.getString(
                                        "captured_by_name"
                                ),
                                resultSet.getTimestamp(
                                        "captured_at"
                                )
                                        .toInstant()
                        ),
                initiativeId
        );
    }

    public List<ImprovementUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role
                FROM app_users
                WHERE active =
                    TRUE
                ORDER BY
                    full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ImprovementUserOptionResponse(
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

    private String snapshotSql() {
        return """
                SELECT
                    snapshot.id,
                    snapshot.snapshot_number,
                    snapshot.currency,
                    snapshot.period_start,
                    snapshot.period_end,
                    snapshot.active_backlog_count,
                    snapshot.sla_overdue_count,
                    snapshot.persistent_exception_count,
                    snapshot.resolved_count,
                    snapshot.sla_attainment_pct,
                    snapshot.avg_resolution_hours,
                    snapshot.avg_active_age_days,
                    snapshot.active_monetary_exposure,
                    snapshot.captured_at

                FROM procurement_operating_rhythm_snapshots
                    snapshot
                """;
    }

    private String initiativeSql() {
        return """
                SELECT
                    initiative.id,
                    initiative.initiative_number,
                    initiative.title,
                    initiative.description,
                    initiative.currency,
                    initiative.priority,
                    initiative.status,
                    initiative.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    initiative.source_snapshot_id,
                    snapshot.snapshot_number
                        AS source_snapshot_number,

                    initiative.scope_type,
                    initiative.scope_key,
                    initiative.scope_label,

                    initiative.baseline_active_count,
                    initiative.baseline_sla_overdue_count,
                    initiative.baseline_persistent_count,
                    initiative.baseline_resolved_count,
                    initiative.baseline_sla_attainment_pct,
                    initiative.baseline_avg_resolution_hours,
                    initiative.baseline_avg_active_age_days,
                    initiative.baseline_active_exposure,

                    initiative.target_sla_attainment_pct,
                    initiative.target_sla_overdue_reduction_pct,
                    initiative.target_persistent_reduction_pct,
                    initiative.target_resolution_hours_reduction_pct,
                    initiative.target_exposure_reduction_pct,

                    initiative.target_date,
                    initiative.notes,

                    COALESCE(
                        action_stats.open_actions,
                        0
                    )
                        AS open_actions,

                    COALESCE(
                        action_stats.overdue_actions,
                        0
                    )
                        AS overdue_actions,

                    COALESCE(
                        checkpoint_stats.checkpoint_count,
                        0
                    )
                        AS checkpoint_count,

                    checkpoint_stats.latest_outcome,
                    checkpoint_stats.latest_achievement_score,

                    initiative.started_at,
                    initiative.completed_at,
                    initiative.cancelled_at,
                    initiative.created_at,
                    initiative.updated_at,
                    initiative.version

                FROM procurement_improvement_initiatives
                    initiative

                JOIN app_users owner
                    ON owner.id =
                       initiative.owner_user_id

                JOIN procurement_operating_rhythm_snapshots
                    snapshot
                    ON snapshot.id =
                       initiative.source_snapshot_id

                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(*)
                        FILTER (
                            WHERE
                                action.status IN (
                                    'PLANNED',
                                    'IN_PROGRESS'
                                )
                        )
                            AS open_actions,

                        COUNT(*)
                        FILTER (
                            WHERE
                                action.status IN (
                                    'PLANNED',
                                    'IN_PROGRESS'
                                )
                            AND action.due_date
                                < CURRENT_DATE
                        )
                            AS overdue_actions

                    FROM procurement_improvement_actions
                        action

                    WHERE
                        action.initiative_id =
                            initiative.id
                )
                    action_stats
                    ON TRUE

                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(*)
                            AS checkpoint_count,

                        (
                            SELECT checkpoint.outcome
                            FROM procurement_improvement_checkpoints checkpoint
                            WHERE checkpoint.initiative_id =
                                initiative.id
                            ORDER BY checkpoint.captured_at DESC
                            LIMIT 1
                        )
                            AS latest_outcome,

                        (
                            SELECT checkpoint.achievement_score
                            FROM procurement_improvement_checkpoints checkpoint
                            WHERE checkpoint.initiative_id =
                                initiative.id
                            ORDER BY checkpoint.captured_at DESC
                            LIMIT 1
                        )
                            AS latest_achievement_score

                    FROM procurement_improvement_checkpoints
                        checkpoint_count_source

                    WHERE
                        checkpoint_count_source.initiative_id =
                            initiative.id
                )
                    checkpoint_stats
                    ON TRUE

                """;
    }

    private String actionSql() {
        return """
                SELECT
                    action.id,
                    action.initiative_id,
                    action.title,
                    action.description,
                    action.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    action.status,
                    action.due_date,
                    action.completion_note,
                    action.started_at,
                    action.completed_at,
                    action.cancelled_at,
                    action.created_at,
                    action.updated_at,
                    action.version

                FROM procurement_improvement_actions
                    action

                JOIN app_users owner
                    ON owner.id =
                       action.owner_user_id

                """;
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
                resultSet.getString(
                        "currency"
                ),
                resultSet.getObject(
                        "period_start",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "period_end",
                        LocalDate.class
                ),
                resultSet.getLong(
                        "active_backlog_count"
                ),
                resultSet.getLong(
                        "sla_overdue_count"
                ),
                resultSet.getLong(
                        "persistent_exception_count"
                ),
                resultSet.getLong(
                        "resolved_count"
                ),
                resultSet.getBigDecimal(
                        "sla_attainment_pct"
                ),
                resultSet.getBigDecimal(
                        "avg_resolution_hours"
                ),
                resultSet.getBigDecimal(
                        "avg_active_age_days"
                ),
                resultSet.getBigDecimal(
                        "active_monetary_exposure"
                ),
                resultSet.getTimestamp(
                        "captured_at"
                )
                        .toInstant()
        );
    }

    private DimensionRow mapDimension(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new DimensionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "snapshot_id",
                        UUID.class
                ),
                ImprovementScopeType.valueOf(
                        resultSet.getString(
                                "dimension_type"
                        )
                ),
                resultSet.getString(
                        "dimension_key"
                ),
                resultSet.getString(
                        "dimension_label"
                ),
                resultSet.getLong(
                        "active_count"
                ),
                resultSet.getLong(
                        "sla_overdue_count"
                ),
                resultSet.getLong(
                        "persistent_count"
                ),
                resultSet.getLong(
                        "resolved_count"
                ),
                resultSet.getBigDecimal(
                        "sla_attainment_pct"
                ),
                resultSet.getBigDecimal(
                        "avg_resolution_hours"
                ),
                resultSet.getBigDecimal(
                        "avg_active_age_days"
                ),
                resultSet.getBigDecimal(
                        "active_exposure"
                ),
                resultSet.getBigDecimal(
                        "workload_share_pct"
                )
        );
    }

    private InitiativeRow mapInitiative(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        String latestOutcome =
                resultSet.getString(
                        "latest_outcome"
                );

        return new InitiativeRow(
                resultSet.getObject(
                        "id",
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
                resultSet.getString(
                        "currency"
                ),
                ImprovementPriority.valueOf(
                        resultSet.getString(
                                "priority"
                        )
                ),
                ImprovementInitiativeStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getObject(
                        "source_snapshot_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_snapshot_number"
                ),
                ImprovementScopeType.valueOf(
                        resultSet.getString(
                                "scope_type"
                        )
                ),
                resultSet.getString(
                        "scope_key"
                ),
                resultSet.getString(
                        "scope_label"
                ),
                resultSet.getLong(
                        "baseline_active_count"
                ),
                resultSet.getLong(
                        "baseline_sla_overdue_count"
                ),
                resultSet.getLong(
                        "baseline_persistent_count"
                ),
                resultSet.getLong(
                        "baseline_resolved_count"
                ),
                resultSet.getBigDecimal(
                        "baseline_sla_attainment_pct"
                ),
                resultSet.getBigDecimal(
                        "baseline_avg_resolution_hours"
                ),
                resultSet.getBigDecimal(
                        "baseline_avg_active_age_days"
                ),
                resultSet.getBigDecimal(
                        "baseline_active_exposure"
                ),
                resultSet.getBigDecimal(
                        "target_sla_attainment_pct"
                ),
                resultSet.getBigDecimal(
                        "target_sla_overdue_reduction_pct"
                ),
                resultSet.getBigDecimal(
                        "target_persistent_reduction_pct"
                ),
                resultSet.getBigDecimal(
                        "target_resolution_hours_reduction_pct"
                ),
                resultSet.getBigDecimal(
                        "target_exposure_reduction_pct"
                ),
                resultSet.getObject(
                        "target_date",
                        LocalDate.class
                ),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getLong(
                        "open_actions"
                ),
                resultSet.getLong(
                        "overdue_actions"
                ),
                resultSet.getLong(
                        "checkpoint_count"
                ),
                latestOutcome == null
                        ? null
                        : ImprovementOutcome.valueOf(
                                latestOutcome
                        ),
                resultSet.getBigDecimal(
                        "latest_achievement_score"
                ),
                instant(
                        resultSet,
                        "started_at"
                ),
                instant(
                        resultSet,
                        "completed_at"
                ),
                instant(
                        resultSet,
                        "cancelled_at"
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

    private ActionRow mapAction(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ActionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "initiative_id",
                        UUID.class
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                ImprovementActionStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                resultSet.getString(
                        "completion_note"
                ),
                instant(
                        resultSet,
                        "started_at"
                ),
                instant(
                        resultSet,
                        "completed_at"
                ),
                instant(
                        resultSet,
                        "cancelled_at"
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

    private Instant instant(
            java.sql.ResultSet resultSet,
            String column
    ) throws java.sql.SQLException {
        Timestamp value =
                resultSet.getTimestamp(
                        column
                );

        return value == null
                ? null
                : value.toInstant();
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

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            String currency,
            LocalDate periodStart,
            LocalDate periodEnd,
            long activeBacklogCount,
            long slaOverdueCount,
            long persistentExceptionCount,
            long resolvedCount,
            BigDecimal slaAttainmentPct,
            BigDecimal avgResolutionHours,
            BigDecimal avgActiveAgeDays,
            BigDecimal activeMonetaryExposure,
            Instant capturedAt
    ) {
    }

    public record DimensionRow(
            UUID id,
            UUID snapshotId,
            ImprovementScopeType scopeType,
            String scopeKey,
            String scopeLabel,
            long activeCount,
            long slaOverdueCount,
            long persistentCount,
            long resolvedCount,
            BigDecimal slaAttainmentPct,
            BigDecimal avgResolutionHours,
            BigDecimal avgActiveAgeDays,
            BigDecimal activeExposure,
            BigDecimal workloadSharePct
    ) {
    }

    public record InitiativeRow(
            UUID id,
            String initiativeNumber,
            String title,
            String description,
            String currency,
            ImprovementPriority priority,
            ImprovementInitiativeStatus status,
            UUID ownerUserId,
            String ownerName,
            UUID sourceSnapshotId,
            String sourceSnapshotNumber,
            ImprovementScopeType scopeType,
            String scopeKey,
            String scopeLabel,
            long baselineActiveCount,
            long baselineSlaOverdueCount,
            long baselinePersistentCount,
            long baselineResolvedCount,
            BigDecimal baselineSlaAttainmentPct,
            BigDecimal baselineAvgResolutionHours,
            BigDecimal baselineAvgActiveAgeDays,
            BigDecimal baselineActiveExposure,
            BigDecimal targetSlaAttainmentPct,
            BigDecimal targetSlaOverdueReductionPct,
            BigDecimal targetPersistentReductionPct,
            BigDecimal targetResolutionHoursReductionPct,
            BigDecimal targetExposureReductionPct,
            LocalDate targetDate,
            String notes,
            long openActions,
            long overdueActions,
            long checkpointCount,
            ImprovementOutcome latestOutcome,
            BigDecimal latestAchievementScore,
            Instant startedAt,
            Instant completedAt,
            Instant cancelledAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ActionRow(
            UUID id,
            UUID initiativeId,
            String title,
            String description,
            UUID ownerUserId,
            String ownerName,
            ImprovementActionStatus status,
            LocalDate dueDate,
            String completionNote,
            Instant startedAt,
            Instant completedAt,
            Instant cancelledAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record CheckpointRow(
            UUID id,
            UUID snapshotId,
            String snapshotNumber,
            long currentActiveCount,
            long currentSlaOverdueCount,
            long currentPersistentCount,
            long currentResolvedCount,
            BigDecimal currentSlaAttainmentPct,
            BigDecimal currentAvgResolutionHours,
            BigDecimal currentAvgActiveAgeDays,
            BigDecimal currentActiveExposure,
            BigDecimal slaAttainmentDelta,
            BigDecimal slaOverdueReductionPct,
            BigDecimal persistentReductionPct,
            BigDecimal resolutionHoursReductionPct,
            BigDecimal exposureReductionPct,
            int targetsMetCount,
            BigDecimal achievementScore,
            ImprovementOutcome outcome,
            String capturedByName,
            Instant capturedAt
    ) {
    }
}
