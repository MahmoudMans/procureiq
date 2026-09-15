package com.procureiq.strategycockpit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class StrategyCockpitRepository {

    private final JdbcTemplate jdbcTemplate;

    public StrategyCockpitRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_board_scorecard_number_seq'
                )
                """,
                Long.class
        );
    }

    public SnapshotRow latestSnapshot(
            String currency,
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE snapshot.currency = ?
                        AND snapshot.fiscal_year = ?

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
                currency,
                fiscalYear
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<SnapshotRow> snapshots(
            String currency,
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE snapshot.currency = ?
                        AND snapshot.fiscal_year = ?

                        ORDER BY
                            snapshot.captured_at DESC

                        LIMIT 24
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        ),
                currency,
                fiscalYear
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

    public List<DimensionRow> dimensions(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    dimension_key,
                    dimension_label,
                    weight_pct,
                    score,
                    weighted_contribution,
                    health,
                    previous_score,
                    score_delta,
                    source_detail

                FROM procurement_board_scorecard_dimensions

                WHERE snapshot_id = ?

                ORDER BY
                    CASE dimension_key
                        WHEN 'OBJECTIVE_EXECUTION'
                        THEN 1
                        WHEN 'STRATEGIC_ALIGNMENT'
                        THEN 2
                        WHEN 'CAPACITY_READINESS'
                        THEN 3
                        WHEN 'CAPABILITY_READINESS'
                        THEN 4
                        WHEN 'SUCCESSION_RESILIENCE'
                        THEN 5
                        ELSE 6
                    END
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new DimensionRow(
                                BoardDimensionKey.valueOf(
                                        resultSet.getString(
                                                "dimension_key"
                                        )
                                ),
                                resultSet.getString(
                                        "dimension_label"
                                ),
                                resultSet.getBigDecimal(
                                        "weight_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "score"
                                ),
                                resultSet.getBigDecimal(
                                        "weighted_contribution"
                                ),
                                BoardHealth.valueOf(
                                        resultSet.getString(
                                                "health"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "previous_score"
                                ),
                                resultSet.getBigDecimal(
                                        "score_delta"
                                ),
                                resultSet.getString(
                                        "source_detail"
                                )
                        ),
                snapshotId
        );
    }

    public List<ExceptionRow> exceptions(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    stable_key,
                    exception_type,
                    severity,
                    title,
                    detail,
                    occurrence_count,
                    metric_value,
                    source_route

                FROM procurement_board_scorecard_exceptions

                WHERE snapshot_id = ?

                ORDER BY
                    CASE severity
                        WHEN 'CRITICAL'
                        THEN 1
                        WHEN 'HIGH'
                        THEN 2
                        WHEN 'MEDIUM'
                        THEN 3
                        ELSE 4
                    END,
                    occurrence_count DESC,
                    stable_key
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ExceptionRow(
                                resultSet.getString(
                                        "stable_key"
                                ),
                                BoardExceptionType.valueOf(
                                        resultSet.getString(
                                                "exception_type"
                                        )
                                ),
                                BoardExceptionSeverity.valueOf(
                                        resultSet.getString(
                                                "severity"
                                        )
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "detail"
                                ),
                                resultSet.getInt(
                                        "occurrence_count"
                                ),
                                resultSet.getBigDecimal(
                                        "metric_value"
                                ),
                                resultSet.getString(
                                        "source_route"
                                )
                        ),
                snapshotId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            BoardScorecardSummaryResponse summary,
            SnapshotRow previous,
            String boardCommentary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_board_scorecard_snapshots (
                    id,
                    snapshot_number,
                    currency,
                    fiscal_year,
                    objective_execution_score,
                    strategic_alignment_score,
                    capacity_score,
                    capability_score,
                    succession_score,
                    overall_score,
                    overall_health,
                    previous_snapshot_id,
                    previous_overall_score,
                    score_delta,
                    movement,
                    strategic_objective_count,
                    off_track_objective_count,
                    unaligned_work_count,
                    overloaded_member_count,
                    critical_capability_gap_count,
                    succession_spof_count,
                    exception_count,
                    critical_exception_count,
                    generated_summary,
                    board_commentary,
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
                summary.currency(),
                summary.fiscalYear(),
                summary.objectiveExecutionScore(),
                summary.strategicAlignmentScore(),
                summary.capacityScore(),
                summary.capabilityScore(),
                summary.successionScore(),
                summary.overallScore(),
                summary.overallHealth()
                        .name(),
                previous == null
                        ? null
                        : previous.id(),
                previous == null
                        ? null
                        : previous.overallScore(),
                summary.scoreDelta(),
                summary.movement()
                        .name(),
                summary.strategicObjectiveCount(),
                summary.offTrackObjectiveCount(),
                summary.unalignedWorkCount(),
                summary.overloadedMemberCount(),
                summary.criticalCapabilityGapCount(),
                summary.successionSpofCount(),
                summary.exceptionCount(),
                summary.criticalExceptionCount(),
                summary.generatedSummary(),
                normalizeOptional(
                        boardCommentary
                ),
                currentUserId
        );
    }

    public void createDimension(
            UUID snapshotId,
            BoardDimensionResponse dimension
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_board_scorecard_dimensions (
                    id,
                    snapshot_id,
                    dimension_key,
                    dimension_label,
                    weight_pct,
                    score,
                    weighted_contribution,
                    health,
                    previous_score,
                    score_delta,
                    source_detail,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                dimension.key()
                        .name(),
                dimension.label(),
                dimension.weightPct(),
                dimension.score(),
                dimension.weightedContribution(),
                dimension.health()
                        .name(),
                dimension.previousScore(),
                dimension.scoreDelta(),
                dimension.sourceDetail()
        );
    }

    public void createException(
            UUID snapshotId,
            BoardExceptionResponse exception
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_board_scorecard_exceptions (
                    id,
                    snapshot_id,
                    stable_key,
                    exception_type,
                    severity,
                    title,
                    detail,
                    occurrence_count,
                    metric_value,
                    source_route,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                exception.stableKey(),
                exception.type()
                        .name(),
                exception.severity()
                        .name(),
                exception.title(),
                exception.detail(),
                exception.occurrenceCount(),
                exception.metricValue(),
                exception.sourceRoute()
        );
    }

    private String snapshotSql() {
        return """
                SELECT
                    snapshot.id,
                    snapshot.snapshot_number,
                    snapshot.currency,
                    snapshot.fiscal_year,
                    snapshot.objective_execution_score,
                    snapshot.strategic_alignment_score,
                    snapshot.capacity_score,
                    snapshot.capability_score,
                    snapshot.succession_score,
                    snapshot.overall_score,
                    snapshot.overall_health,
                    snapshot.previous_snapshot_id,
                    snapshot.previous_overall_score,
                    snapshot.score_delta,
                    snapshot.movement,
                    snapshot.strategic_objective_count,
                    snapshot.off_track_objective_count,
                    snapshot.unaligned_work_count,
                    snapshot.overloaded_member_count,
                    snapshot.critical_capability_gap_count,
                    snapshot.succession_spof_count,
                    snapshot.exception_count,
                    snapshot.critical_exception_count,
                    snapshot.generated_summary,
                    snapshot.board_commentary,

                    user_account.full_name
                        AS captured_by_name,

                    snapshot.captured_at

                FROM procurement_board_scorecard_snapshots
                    snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       snapshot.captured_by_user_id

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
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "objective_execution_score"
                ),
                resultSet.getBigDecimal(
                        "strategic_alignment_score"
                ),
                resultSet.getBigDecimal(
                        "capacity_score"
                ),
                resultSet.getBigDecimal(
                        "capability_score"
                ),
                resultSet.getBigDecimal(
                        "succession_score"
                ),
                resultSet.getBigDecimal(
                        "overall_score"
                ),
                BoardHealth.valueOf(
                        resultSet.getString(
                                "overall_health"
                        )
                ),
                resultSet.getObject(
                        "previous_snapshot_id",
                        UUID.class
                ),
                resultSet.getBigDecimal(
                        "previous_overall_score"
                ),
                resultSet.getBigDecimal(
                        "score_delta"
                ),
                BoardMovement.valueOf(
                        resultSet.getString(
                                "movement"
                        )
                ),
                resultSet.getInt(
                        "strategic_objective_count"
                ),
                resultSet.getInt(
                        "off_track_objective_count"
                ),
                resultSet.getInt(
                        "unaligned_work_count"
                ),
                resultSet.getInt(
                        "overloaded_member_count"
                ),
                resultSet.getInt(
                        "critical_capability_gap_count"
                ),
                resultSet.getInt(
                        "succession_spof_count"
                ),
                resultSet.getInt(
                        "exception_count"
                ),
                resultSet.getInt(
                        "critical_exception_count"
                ),
                resultSet.getString(
                        "generated_summary"
                ),
                resultSet.getString(
                        "board_commentary"
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

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            String currency,
            int fiscalYear,
            BigDecimal objectiveExecutionScore,
            BigDecimal strategicAlignmentScore,
            BigDecimal capacityScore,
            BigDecimal capabilityScore,
            BigDecimal successionScore,
            BigDecimal overallScore,
            BoardHealth overallHealth,
            UUID previousSnapshotId,
            BigDecimal previousOverallScore,
            BigDecimal scoreDelta,
            BoardMovement movement,
            int strategicObjectiveCount,
            int offTrackObjectiveCount,
            int unalignedWorkCount,
            int overloadedMemberCount,
            int criticalCapabilityGapCount,
            int successionSpofCount,
            int exceptionCount,
            int criticalExceptionCount,
            String generatedSummary,
            String boardCommentary,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record DimensionRow(
            BoardDimensionKey key,
            String label,
            BigDecimal weightPct,
            BigDecimal score,
            BigDecimal weightedContribution,
            BoardHealth health,
            BigDecimal previousScore,
            BigDecimal scoreDelta,
            String sourceDetail
    ) {
    }

    public record ExceptionRow(
            String stableKey,
            BoardExceptionType type,
            BoardExceptionSeverity severity,
            String title,
            String detail,
            int occurrenceCount,
            BigDecimal metricValue,
            String sourceRoute
    ) {
    }
}
