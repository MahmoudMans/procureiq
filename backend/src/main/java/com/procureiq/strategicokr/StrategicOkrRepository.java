package com.procureiq.strategicokr;

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
public class StrategicOkrRepository {

    private final JdbcTemplate jdbcTemplate;

    public StrategicOkrRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextObjectiveSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategic_objective_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_okr_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public void createObjective(
            UUID objectiveId,
            String objectiveNumber,
            StrategicObjectiveInput input,
            String currency,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategic_objectives (
                    id,
                    objective_number,
                    title,
                    description,
                    currency,
                    period_type,
                    fiscal_year,
                    quarter,
                    start_date,
                    end_date,
                    status,
                    owner_user_id,
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
                    'DRAFT',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                objectiveId,
                objectiveNumber,
                input.title()
                        .trim(),
                input.description()
                        .trim(),
                currency,
                input.periodType()
                        .name(),
                input.fiscalYear(),
                input.quarter(),
                input.startDate(),
                input.endDate(),
                ownerUserId
        );
    }

    public ObjectiveRow findObjective(
            UUID objectiveId
    ) {
        return jdbcTemplate.query(
                objectiveSql()
                        + """
                        WHERE objective.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapObjective(
                                resultSet
                        ),
                objectiveId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ObjectiveRow> objectives(
            String currency,
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                objectiveSql()
                        + """
                        WHERE objective.currency = ?
                        AND objective.fiscal_year = ?

                        ORDER BY
                            CASE objective.status
                                WHEN 'ACTIVE'
                                THEN 1
                                WHEN 'ON_HOLD'
                                THEN 2
                                WHEN 'DRAFT'
                                THEN 3
                                WHEN 'ACHIEVED'
                                THEN 4
                                WHEN 'CLOSED'
                                THEN 5
                                ELSE 6
                            END,
                            objective.end_date,
                            objective.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapObjective(
                                resultSet
                        ),
                currency,
                fiscalYear
        );
    }

    public void startObjective(
            UUID objectiveId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategic_objectives
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
                objectiveId
        );
    }

    public void holdObjective(
            UUID objectiveId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategic_objectives
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
                objectiveId
        );
    }

    public void resumeObjective(
            UUID objectiveId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategic_objectives
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
                objectiveId
        );
    }

    public void achieveObjective(
            UUID objectiveId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategic_objectives
                SET
                    status =
                        'ACHIEVED',
                    achieved_at =
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
                objectiveId
        );
    }

    public void closeObjective(
            UUID objectiveId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategic_objectives
                SET
                    status =
                        'CLOSED',
                    closed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'ACHIEVED'
                """,
                objectiveId
        );
    }

    public void cancelObjective(
            UUID objectiveId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategic_objectives
                SET
                    status =
                        'CANCELLED',
                    cancellation_note = ?,
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
                note.trim(),
                objectiveId
        );
    }

    public void createKeyResult(
            UUID keyResultId,
            UUID objectiveId,
            KeyResultInput input,
            OkrSourceScopeType scopeType,
            String scopeKey,
            BigDecimal actualValue,
            Instant observedAt,
            String status
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_key_results (
                    id,
                    objective_id,
                    title,
                    description,
                    metric_type,
                    direction,
                    source_type,
                    source_scope_type,
                    source_scope_key,
                    baseline_value,
                    target_value,
                    actual_value,
                    weight_pct,
                    source_observed_at,
                    actual_updated_at,
                    status,
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
                    ?,
                    CURRENT_TIMESTAMP,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                keyResultId,
                objectiveId,
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                input.metricType()
                        .name(),
                input.direction()
                        .name(),
                input.sourceType()
                        .name(),
                scopeType == null
                        ? null
                        : scopeType.name(),
                scopeKey,
                input.baselineValue(),
                input.targetValue(),
                actualValue,
                input.weightPct(),
                observedAt == null
                        ? null
                        : Timestamp.from(
                                observedAt
                        ),
                status
        );
    }

    public KeyResultRow findKeyResult(
            UUID keyResultId
    ) {
        return jdbcTemplate.query(
                keyResultSql()
                        + """
                        WHERE kr.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapKeyResult(
                                resultSet
                        ),
                keyResultId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<KeyResultRow> keyResults(
            UUID objectiveId
    ) {
        return jdbcTemplate.query(
                keyResultSql()
                        + """
                        WHERE kr.objective_id = ?

                        ORDER BY
                            kr.created_at,
                            kr.title
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapKeyResult(
                                resultSet
                        ),
                objectiveId
        );
    }

    public void updateActual(
            UUID keyResultId,
            BigDecimal actualValue,
            Instant observedAt,
            String manualNote,
            String status
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_key_results
                SET
                    actual_value = ?,
                    source_observed_at = ?,
                    actual_updated_at =
                        CURRENT_TIMESTAMP,
                    manual_note = ?,
                    status = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                actualValue,
                observedAt == null
                        ? null
                        : Timestamp.from(
                                observedAt
                        ),
                manualNote,
                status,
                keyResultId
        );
    }

    public OperatingMetricRow latestOperatingMetric(
            String currency,
            OkrSourceScopeType scopeType,
            String scopeKey
    ) {
        if (
                scopeType == null
                ||
                scopeType
                        == OkrSourceScopeType.OVERALL
        ) {
            return jdbcTemplate.query(
                    """
                    SELECT
                        snapshot.id
                            AS snapshot_id,

                        snapshot.active_backlog_count
                            AS active_count,

                        snapshot.sla_overdue_count,

                        snapshot.persistent_exception_count
                            AS persistent_count,

                        snapshot.sla_attainment_pct,

                        snapshot.avg_resolution_hours,

                        snapshot.active_monetary_exposure
                            AS active_exposure,

                        snapshot.captured_at

                    FROM procurement_operating_rhythm_snapshots
                        snapshot

                    WHERE snapshot.currency = ?

                    ORDER BY
                        snapshot.captured_at DESC

                    LIMIT 1
                    """,
                    (
                            resultSet,
                            rowNumber
                    ) ->
                            new OperatingMetricRow(
                                    resultSet.getObject(
                                            "snapshot_id",
                                            UUID.class
                                    ),
                                    resultSet.getBigDecimal(
                                            "active_count"
                                    ),
                                    resultSet.getBigDecimal(
                                            "sla_overdue_count"
                                    ),
                                    resultSet.getBigDecimal(
                                            "persistent_count"
                                    ),
                                    resultSet.getBigDecimal(
                                            "sla_attainment_pct"
                                    ),
                                    resultSet.getBigDecimal(
                                            "avg_resolution_hours"
                                    ),
                                    resultSet.getBigDecimal(
                                            "active_exposure"
                                    ),
                                    resultSet.getTimestamp(
                                            "captured_at"
                                    )
                                            .toInstant()
                            ),
                    currency
            )
                    .stream()
                    .findFirst()
                    .orElse(null);
        }

        return jdbcTemplate.query(
                """
                WITH latest_snapshot AS (
                    SELECT
                        snapshot.id,
                        snapshot.captured_at

                    FROM procurement_operating_rhythm_snapshots
                        snapshot

                    WHERE snapshot.currency = ?

                    ORDER BY
                        snapshot.captured_at DESC

                    LIMIT 1
                )

                SELECT
                    latest_snapshot.id
                        AS snapshot_id,

                    dimension.active_count,
                    dimension.sla_overdue_count,
                    dimension.persistent_count,
                    dimension.sla_attainment_pct,
                    dimension.avg_resolution_hours,
                    dimension.active_exposure,
                    latest_snapshot.captured_at

                FROM latest_snapshot

                JOIN procurement_operating_rhythm_dimensions
                    dimension
                    ON dimension.snapshot_id =
                       latest_snapshot.id

                WHERE dimension.dimension_type = ?
                AND dimension.dimension_key = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new OperatingMetricRow(
                                resultSet.getObject(
                                        "snapshot_id",
                                        UUID.class
                                ),
                                resultSet.getBigDecimal(
                                        "active_count"
                                ),
                                resultSet.getBigDecimal(
                                        "sla_overdue_count"
                                ),
                                resultSet.getBigDecimal(
                                        "persistent_count"
                                ),
                                resultSet.getBigDecimal(
                                        "sla_attainment_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "avg_resolution_hours"
                                ),
                                resultSet.getBigDecimal(
                                        "active_exposure"
                                ),
                                resultSet.getTimestamp(
                                        "captured_at"
                                )
                                        .toInstant()
                        ),
                currency,
                scopeType.name(),
                scopeKey
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public ImprovementMetricsRow improvementMetrics(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    COUNT(*)
                    FILTER (
                        WHERE
                            initiative.status IN (
                                'ACTIVE',
                                'ON_HOLD'
                            )
                    )
                        AS active_count,

                    COUNT(*)
                    FILTER (
                        WHERE
                            initiative.status =
                                'COMPLETED'
                    )
                        AS completed_count,

                    COUNT(*)
                    FILTER (
                        WHERE
                            latest.outcome =
                                'IMPROVED'
                    )
                        AS improved_count,

                    COUNT(*)
                    FILTER (
                        WHERE
                            initiative.status
                                <> 'CANCELLED'
                    )
                        AS eligible_count,

                    CURRENT_TIMESTAMP
                        AS observed_at

                FROM procurement_improvement_initiatives
                    initiative

                LEFT JOIN LATERAL (
                    SELECT
                        checkpoint.outcome

                    FROM procurement_improvement_checkpoints
                        checkpoint

                    WHERE
                        checkpoint.initiative_id =
                            initiative.id

                    ORDER BY
                        checkpoint.captured_at DESC

                    LIMIT 1
                )
                    latest
                    ON TRUE

                WHERE initiative.currency = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ImprovementMetricsRow(
                                resultSet.getLong(
                                        "active_count"
                                ),
                                resultSet.getLong(
                                        "completed_count"
                                ),
                                resultSet.getLong(
                                        "improved_count"
                                ),
                                resultSet.getLong(
                                        "eligible_count"
                                ),
                                resultSet.getTimestamp(
                                        "observed_at"
                                )
                                        .toInstant()
                        ),
                currency
        )
                .stream()
                .findFirst()
                .orElseThrow();
    }

    public List<OkrOperatingScopeOptionResponse> operatingScopes(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                WITH latest_snapshot AS (
                    SELECT id

                    FROM procurement_operating_rhythm_snapshots

                    WHERE currency = ?

                    ORDER BY
                        captured_at DESC

                    LIMIT 1
                )

                SELECT
                    dimension_type,
                    dimension_key,
                    dimension_label

                FROM procurement_operating_rhythm_dimensions

                WHERE snapshot_id =
                    (
                        SELECT id
                        FROM latest_snapshot
                    )

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
                    dimension_label
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new OkrOperatingScopeOptionResponse(
                                OkrSourceScopeType.valueOf(
                                        resultSet.getString(
                                                "dimension_type"
                                        )
                                ),
                                resultSet.getString(
                                        "dimension_key"
                                ),
                                resultSet.getString(
                                        "dimension_label"
                                )
                        ),
                currency
        );
    }

    public void createContribution(
            UUID contributionId,
            UUID keyResultId,
            OkrContributionInput input
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_okr_contributions (
                    id,
                    key_result_id,
                    improvement_initiative_id,
                    contribution_weight_pct,
                    rationale,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                contributionId,
                keyResultId,
                input.improvementInitiativeId(),
                input.contributionWeightPct(),
                input.rationale()
                        .trim()
        );
    }

    public List<ContributionRow> contributions(
            UUID keyResultId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    contribution.id,
                    contribution.improvement_initiative_id,
                    initiative.initiative_number,
                    initiative.title,
                    initiative.status,
                    contribution.contribution_weight_pct,
                    contribution.rationale

                FROM procurement_okr_contributions
                    contribution

                JOIN procurement_improvement_initiatives
                    initiative
                    ON initiative.id =
                       contribution.improvement_initiative_id

                WHERE contribution.key_result_id = ?

                ORDER BY
                    contribution.contribution_weight_pct DESC,
                    initiative.initiative_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ContributionRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "improvement_initiative_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "initiative_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getBigDecimal(
                                        "contribution_weight_pct"
                                ),
                                resultSet.getString(
                                        "rationale"
                                )
                        ),
                keyResultId
        );
    }

    public List<OkrImprovementOptionResponse> improvementOptions(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    initiative_number,
                    title,
                    status

                FROM procurement_improvement_initiatives

                WHERE currency = ?
                AND status
                    <> 'CANCELLED'

                ORDER BY
                    CASE status
                        WHEN 'ACTIVE'
                        THEN 1
                        WHEN 'ON_HOLD'
                        THEN 2
                        WHEN 'DRAFT'
                        THEN 3
                        ELSE 4
                    END,
                    initiative_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new OkrImprovementOptionResponse(
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
                                        "status"
                                )
                        ),
                currency
        );
    }

    public ImprovementOptionRow findImprovement(
            UUID initiativeId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    initiative_number,
                    title,
                    status,
                    currency

                FROM procurement_improvement_initiatives

                WHERE id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ImprovementOptionRow(
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
                                        "status"
                                ),
                                resultSet.getString(
                                        "currency"
                                )
                        ),
                initiativeId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            ObjectiveRow objective,
            BigDecimal progress,
            StrategicHealth health,
            BigDecimal confidence,
            int keyResultCount,
            int achievedCount,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_okr_snapshots (
                    id,
                    snapshot_number,
                    objective_id,
                    objective_number,
                    objective_title,
                    currency,
                    period_type,
                    fiscal_year,
                    quarter,
                    objective_status,
                    overall_progress_pct,
                    overall_health,
                    overall_confidence_pct,
                    key_result_count,
                    achieved_key_result_count,
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
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,
                objective.id(),
                objective.objectiveNumber(),
                objective.title(),
                objective.currency(),
                objective.periodType()
                        .name(),
                objective.fiscalYear(),
                objective.quarter(),
                objective.status()
                        .name(),
                progress,
                health.name(),
                confidence,
                keyResultCount,
                achievedCount,
                currentUserId
        );
    }

    public void createSnapshotKeyResult(
            UUID snapshotId,
            KeyResultRow keyResult,
            BigDecimal progress,
            StrategicHealth health,
            BigDecimal confidence,
            int contributionCount
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_okr_snapshot_key_results (
                    id,
                    snapshot_id,
                    key_result_id,
                    title,
                    metric_type,
                    direction,
                    source_type,
                    source_scope_type,
                    source_scope_key,
                    baseline_value,
                    target_value,
                    actual_value,
                    weight_pct,
                    progress_pct,
                    health,
                    confidence_pct,
                    source_observed_at,
                    contribution_count,
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
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                keyResult.id(),
                keyResult.title(),
                keyResult.metricType()
                        .name(),
                keyResult.direction()
                        .name(),
                keyResult.sourceType()
                        .name(),
                keyResult.sourceScopeType()
                        == null
                        ? null
                        : keyResult
                                .sourceScopeType()
                                .name(),
                keyResult.sourceScopeKey(),
                keyResult.baselineValue(),
                keyResult.targetValue(),
                keyResult.actualValue(),
                keyResult.weightPct(),
                progress,
                health.name(),
                confidence,
                keyResult.sourceObservedAt()
                        == null
                        ? null
                        : Timestamp.from(
                                keyResult.sourceObservedAt()
                        ),
                contributionCount
        );
    }

    public List<SnapshotRow> snapshots(
            UUID objectiveId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    snapshot.id,
                    snapshot.snapshot_number,
                    snapshot.objective_id,
                    snapshot.objective_number,
                    snapshot.objective_title,
                    snapshot.currency,
                    snapshot.period_type,
                    snapshot.fiscal_year,
                    snapshot.quarter,
                    snapshot.objective_status,
                    snapshot.overall_progress_pct,
                    snapshot.overall_health,
                    snapshot.overall_confidence_pct,
                    snapshot.key_result_count,
                    snapshot.achieved_key_result_count,

                    user_account.full_name
                        AS captured_by_name,

                    snapshot.captured_at

                FROM procurement_okr_snapshots
                    snapshot

                JOIN app_users user_account
                    ON user_account.id =
                       snapshot.captured_by_user_id

                WHERE snapshot.objective_id = ?

                ORDER BY
                    snapshot.captured_at DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        ),
                objectiveId
        );
    }

    public SnapshotRow findSnapshotRow(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    snapshot.id,
                    snapshot.snapshot_number,
                    snapshot.objective_id,
                    snapshot.objective_number,
                    snapshot.objective_title,
                    snapshot.currency,
                    snapshot.period_type,
                    snapshot.fiscal_year,
                    snapshot.quarter,
                    snapshot.objective_status,
                    snapshot.overall_progress_pct,
                    snapshot.overall_health,
                    snapshot.overall_confidence_pct,
                    snapshot.key_result_count,
                    snapshot.achieved_key_result_count,

                    user_account.full_name
                        AS captured_by_name,

                    snapshot.captured_at

                FROM procurement_okr_snapshots
                    snapshot

                JOIN app_users user_account
                    ON user_account.id =
                       snapshot.captured_by_user_id

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

    public List<SnapshotKeyResultRow> snapshotKeyResults(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    key_result_id,
                    title,
                    metric_type,
                    direction,
                    source_type,
                    source_scope_type,
                    source_scope_key,
                    baseline_value,
                    target_value,
                    actual_value,
                    weight_pct,
                    progress_pct,
                    health,
                    confidence_pct,
                    source_observed_at,
                    contribution_count

                FROM procurement_okr_snapshot_key_results

                WHERE snapshot_id = ?

                ORDER BY
                    weight_pct DESC,
                    title
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    String scopeType =
                            resultSet.getString(
                                    "source_scope_type"
                            );

                    return new SnapshotKeyResultRow(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "key_result_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "title"
                            ),
                            KeyResultMetricType.valueOf(
                                    resultSet.getString(
                                            "metric_type"
                                    )
                            ),
                            KeyResultDirection.valueOf(
                                    resultSet.getString(
                                            "direction"
                                    )
                            ),
                            KeyResultSourceType.valueOf(
                                    resultSet.getString(
                                            "source_type"
                                    )
                            ),
                            scopeType == null
                                    ? null
                                    : OkrSourceScopeType.valueOf(
                                            scopeType
                                    ),
                            resultSet.getString(
                                    "source_scope_key"
                            ),
                            resultSet.getBigDecimal(
                                    "baseline_value"
                            ),
                            resultSet.getBigDecimal(
                                    "target_value"
                            ),
                            resultSet.getBigDecimal(
                                    "actual_value"
                            ),
                            resultSet.getBigDecimal(
                                    "weight_pct"
                            ),
                            resultSet.getBigDecimal(
                                    "progress_pct"
                            ),
                            StrategicHealth.valueOf(
                                    resultSet.getString(
                                            "health"
                                    )
                            ),
                            resultSet.getBigDecimal(
                                    "confidence_pct"
                            ),
                            instant(
                                    resultSet,
                                    "source_observed_at"
                            ),
                            resultSet.getInt(
                                    "contribution_count"
                            )
                    );
                },
                snapshotId
        );
    }

    public List<OkrUserOptionResponse> users() {
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
                        new OkrUserOptionResponse(
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

    private String objectiveSql() {
        return """
                SELECT
                    objective.id,
                    objective.objective_number,
                    objective.title,
                    objective.description,
                    objective.currency,
                    objective.period_type,
                    objective.fiscal_year,
                    objective.quarter,
                    objective.start_date,
                    objective.end_date,
                    objective.status,
                    objective.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    objective.started_at,
                    objective.achieved_at,
                    objective.closed_at,
                    objective.cancelled_at,
                    objective.cancellation_note,
                    objective.created_at,
                    objective.updated_at,
                    objective.version

                FROM procurement_strategic_objectives
                    objective

                JOIN app_users owner
                    ON owner.id =
                       objective.owner_user_id

                """;
    }

    private String keyResultSql() {
        return """
                SELECT
                    kr.id,
                    kr.objective_id,
                    kr.title,
                    kr.description,
                    kr.metric_type,
                    kr.direction,
                    kr.source_type,
                    kr.source_scope_type,
                    kr.source_scope_key,
                    kr.baseline_value,
                    kr.target_value,
                    kr.actual_value,
                    kr.weight_pct,
                    kr.source_observed_at,
                    kr.actual_updated_at,
                    kr.manual_note,
                    kr.status,
                    kr.created_at,
                    kr.updated_at,
                    kr.version

                FROM procurement_key_results
                    kr

                """;
    }

    private ObjectiveRow mapObjective(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ObjectiveRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "objective_number"
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
                StrategicObjectivePeriodType.valueOf(
                        resultSet.getString(
                                "period_type"
                        )
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                (
                        Integer
                ) resultSet.getObject(
                        "quarter"
                ),
                resultSet.getObject(
                        "start_date",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "end_date",
                        LocalDate.class
                ),
                StrategicObjectiveStatus.valueOf(
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
                instant(
                        resultSet,
                        "started_at"
                ),
                instant(
                        resultSet,
                        "achieved_at"
                ),
                instant(
                        resultSet,
                        "closed_at"
                ),
                instant(
                        resultSet,
                        "cancelled_at"
                ),
                resultSet.getString(
                        "cancellation_note"
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

    private KeyResultRow mapKeyResult(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        String scopeType =
                resultSet.getString(
                        "source_scope_type"
                );

        return new KeyResultRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "objective_id",
                        UUID.class
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
                ),
                KeyResultMetricType.valueOf(
                        resultSet.getString(
                                "metric_type"
                        )
                ),
                KeyResultDirection.valueOf(
                        resultSet.getString(
                                "direction"
                        )
                ),
                KeyResultSourceType.valueOf(
                        resultSet.getString(
                                "source_type"
                        )
                ),
                scopeType == null
                        ? null
                        : OkrSourceScopeType.valueOf(
                                scopeType
                        ),
                resultSet.getString(
                        "source_scope_key"
                ),
                resultSet.getBigDecimal(
                        "baseline_value"
                ),
                resultSet.getBigDecimal(
                        "target_value"
                ),
                resultSet.getBigDecimal(
                        "actual_value"
                ),
                resultSet.getBigDecimal(
                        "weight_pct"
                ),
                instant(
                        resultSet,
                        "source_observed_at"
                ),
                instant(
                        resultSet,
                        "actual_updated_at"
                ),
                resultSet.getString(
                        "manual_note"
                ),
                resultSet.getString(
                        "status"
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
                        "objective_id",
                        UUID.class
                ),
                resultSet.getString(
                        "objective_number"
                ),
                resultSet.getString(
                        "objective_title"
                ),
                resultSet.getString(
                        "currency"
                ),
                StrategicObjectivePeriodType.valueOf(
                        resultSet.getString(
                                "period_type"
                        )
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                (
                        Integer
                ) resultSet.getObject(
                        "quarter"
                ),
                resultSet.getString(
                        "objective_status"
                ),
                resultSet.getBigDecimal(
                        "overall_progress_pct"
                ),
                StrategicHealth.valueOf(
                        resultSet.getString(
                                "overall_health"
                        )
                ),
                resultSet.getBigDecimal(
                        "overall_confidence_pct"
                ),
                resultSet.getInt(
                        "key_result_count"
                ),
                resultSet.getInt(
                        "achieved_key_result_count"
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

    public record ObjectiveRow(
            UUID id,
            String objectiveNumber,
            String title,
            String description,
            String currency,
            StrategicObjectivePeriodType periodType,
            int fiscalYear,
            Integer quarter,
            LocalDate startDate,
            LocalDate endDate,
            StrategicObjectiveStatus status,
            UUID ownerUserId,
            String ownerName,
            Instant startedAt,
            Instant achievedAt,
            Instant closedAt,
            Instant cancelledAt,
            String cancellationNote,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record KeyResultRow(
            UUID id,
            UUID objectiveId,
            String title,
            String description,
            KeyResultMetricType metricType,
            KeyResultDirection direction,
            KeyResultSourceType sourceType,
            OkrSourceScopeType sourceScopeType,
            String sourceScopeKey,
            BigDecimal baselineValue,
            BigDecimal targetValue,
            BigDecimal actualValue,
            BigDecimal weightPct,
            Instant sourceObservedAt,
            Instant actualUpdatedAt,
            String manualNote,
            String status,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record OperatingMetricRow(
            UUID snapshotId,
            BigDecimal activeCount,
            BigDecimal slaOverdueCount,
            BigDecimal persistentCount,
            BigDecimal slaAttainmentPct,
            BigDecimal avgResolutionHours,
            BigDecimal activeExposure,
            Instant observedAt
    ) {
    }

    public record ImprovementMetricsRow(
            long activeCount,
            long completedCount,
            long improvedCount,
            long eligibleCount,
            Instant observedAt
    ) {
    }

    public record ContributionRow(
            UUID id,
            UUID improvementInitiativeId,
            String initiativeNumber,
            String initiativeTitle,
            String initiativeStatus,
            BigDecimal contributionWeightPct,
            String rationale
    ) {
    }

    public record ImprovementOptionRow(
            UUID id,
            String initiativeNumber,
            String title,
            String status,
            String currency
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            UUID objectiveId,
            String objectiveNumber,
            String objectiveTitle,
            String currency,
            StrategicObjectivePeriodType periodType,
            int fiscalYear,
            Integer quarter,
            String objectiveStatus,
            BigDecimal overallProgressPct,
            StrategicHealth overallHealth,
            BigDecimal overallConfidencePct,
            int keyResultCount,
            int achievedKeyResultCount,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotKeyResultRow(
            UUID id,
            UUID keyResultId,
            String title,
            KeyResultMetricType metricType,
            KeyResultDirection direction,
            KeyResultSourceType sourceType,
            OkrSourceScopeType sourceScopeType,
            String sourceScopeKey,
            BigDecimal baselineValue,
            BigDecimal targetValue,
            BigDecimal actualValue,
            BigDecimal weightPct,
            BigDecimal progressPct,
            StrategicHealth health,
            BigDecimal confidencePct,
            Instant sourceObservedAt,
            int contributionCount
    ) {
    }
}
