package com.procureiq.operatingrhythm;

import com.procureiq.controltower.ControlTowerExceptionType;
import com.procureiq.controltower.ControlTowerItemStatus;
import com.procureiq.controltower.ControlTowerSeverity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class OperatingRhythmRepository {

    private final JdbcTemplate jdbcTemplate;

    public OperatingRhythmRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_operating_rhythm_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<OperatingRhythmSourceItem> sourceItems(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    item.id,
                    item.exception_type,
                    item.severity,
                    item.status,
                    item.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    item.monetary_exposure,
                    item.first_seen_at,
                    item.sla_due_at,
                    item.resolved_at

                FROM procurement_control_tower_items
                    item

                LEFT JOIN app_users owner
                    ON owner.id =
                       item.owner_user_id

                WHERE item.currency = ?

                AND item.status IN (
                    'OPEN',
                    'ACKNOWLEDGED',
                    'IN_PROGRESS',
                    'RESOLVED'
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new OperatingRhythmSourceItem(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                ControlTowerExceptionType.valueOf(
                                        resultSet.getString(
                                                "exception_type"
                                        )
                                ),
                                ControlTowerSeverity.valueOf(
                                        resultSet.getString(
                                                "severity"
                                        )
                                ),
                                ControlTowerItemStatus.valueOf(
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
                                resultSet.getBigDecimal(
                                        "monetary_exposure"
                                ),
                                resultSet.getTimestamp(
                                        "first_seen_at"
                                )
                                        .toInstant(),
                                resultSet.getTimestamp(
                                        "sla_due_at"
                                )
                                        .toInstant(),
                                instant(
                                        resultSet,
                                        "resolved_at"
                                )
                        ),
                currency
        );
    }

    public void insertSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            String currency,
            LocalDate periodStart,
            LocalDate periodEnd,
            UUID currentUserId,
            OperatingRhythmMetrics metrics
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_operating_rhythm_snapshots (
                    id,
                    snapshot_number,
                    currency,
                    period_start,
                    period_end,
                    captured_by_user_id,
                    active_backlog_count,
                    critical_backlog_count,
                    high_backlog_count,
                    sla_overdue_count,
                    unassigned_count,
                    persistent_exception_count,
                    resolved_count,
                    on_time_resolved_count,
                    late_resolved_count,
                    sla_attainment_pct,
                    avg_resolution_hours,
                    avg_active_age_days,
                    active_monetary_exposure,
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
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,
                currency,
                periodStart,
                periodEnd,
                currentUserId,
                metrics.activeBacklogCount(),
                metrics.criticalBacklogCount(),
                metrics.highBacklogCount(),
                metrics.slaOverdueCount(),
                metrics.unassignedCount(),
                metrics.persistentExceptionCount(),
                metrics.resolvedCount(),
                metrics.onTimeResolvedCount(),
                metrics.lateResolvedCount(),
                metrics.slaAttainmentPct(),
                metrics.avgResolutionHours(),
                metrics.avgActiveAgeDays(),
                metrics.activeMonetaryExposure()
        );
    }

    public void insertDimension(
            UUID snapshotId,
            OperatingRhythmDimensionMetric dimension
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_operating_rhythm_dimensions (
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
                    workload_share_pct,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                dimension.dimensionType()
                        .name(),
                dimension.dimensionKey(),
                dimension.dimensionLabel(),
                dimension.activeCount(),
                dimension.slaOverdueCount(),
                dimension.persistentCount(),
                dimension.resolvedCount(),
                dimension.onTimeResolvedCount(),
                dimension.slaAttainmentPct(),
                dimension.avgResolutionHours(),
                dimension.avgActiveAgeDays(),
                dimension.activeExposure(),
                dimension.workloadSharePct()
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
                        new DimensionRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "snapshot_id",
                                        UUID.class
                                ),
                                OperatingRhythmDimensionType.valueOf(
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
                                resultSet.getLong(
                                        "on_time_resolved_count"
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
                        ),
                snapshotId
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

                    user_account.full_name
                        AS captured_by_name,

                    snapshot.active_backlog_count,
                    snapshot.critical_backlog_count,
                    snapshot.high_backlog_count,
                    snapshot.sla_overdue_count,
                    snapshot.unassigned_count,
                    snapshot.persistent_exception_count,
                    snapshot.resolved_count,
                    snapshot.on_time_resolved_count,
                    snapshot.late_resolved_count,
                    snapshot.sla_attainment_pct,
                    snapshot.avg_resolution_hours,
                    snapshot.avg_active_age_days,
                    snapshot.active_monetary_exposure,
                    snapshot.captured_at

                FROM procurement_operating_rhythm_snapshots
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
                resultSet.getObject(
                        "period_start",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "period_end",
                        LocalDate.class
                ),
                resultSet.getString(
                        "captured_by_name"
                ),
                resultSet.getLong(
                        "active_backlog_count"
                ),
                resultSet.getLong(
                        "critical_backlog_count"
                ),
                resultSet.getLong(
                        "high_backlog_count"
                ),
                resultSet.getLong(
                        "sla_overdue_count"
                ),
                resultSet.getLong(
                        "unassigned_count"
                ),
                resultSet.getLong(
                        "persistent_exception_count"
                ),
                resultSet.getLong(
                        "resolved_count"
                ),
                resultSet.getLong(
                        "on_time_resolved_count"
                ),
                resultSet.getLong(
                        "late_resolved_count"
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

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,
            String currency,
            LocalDate periodStart,
            LocalDate periodEnd,
            String capturedByName,
            long activeBacklogCount,
            long criticalBacklogCount,
            long highBacklogCount,
            long slaOverdueCount,
            long unassignedCount,
            long persistentExceptionCount,
            long resolvedCount,
            long onTimeResolvedCount,
            long lateResolvedCount,
            java.math.BigDecimal slaAttainmentPct,
            java.math.BigDecimal avgResolutionHours,
            java.math.BigDecimal avgActiveAgeDays,
            java.math.BigDecimal activeMonetaryExposure,
            Instant capturedAt
    ) {
    }

    public record DimensionRow(
            UUID id,
            UUID snapshotId,
            OperatingRhythmDimensionType dimensionType,
            String dimensionKey,
            String dimensionLabel,
            long activeCount,
            long slaOverdueCount,
            long persistentCount,
            long resolvedCount,
            long onTimeResolvedCount,
            java.math.BigDecimal slaAttainmentPct,
            java.math.BigDecimal avgResolutionHours,
            java.math.BigDecimal avgActiveAgeDays,
            java.math.BigDecimal activeExposure,
            java.math.BigDecimal workloadSharePct
    ) {
    }
}
