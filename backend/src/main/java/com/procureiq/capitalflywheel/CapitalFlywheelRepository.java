package com.procureiq.capitalflywheel;

import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceHealth;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class CapitalFlywheelRepository {

    private final JdbcTemplate jdbcTemplate;

    public CapitalFlywheelRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextLineageSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_capital_flywheel_lineage_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_capital_flywheel_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<CapitalFlywheelUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role

                FROM app_users

                WHERE active = TRUE
                AND role <> 'REQUESTER'

                ORDER BY
                    full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CapitalFlywheelUserOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "full_name"
                                ),
                                resultSet.getString(
                                        "role"
                                )
                        )
        );
    }

    public boolean persistenceCaseAlreadyUsed(
            UUID persistenceCaseId
    ) {
        Integer count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)

                        FROM procurement_capital_flywheel_cycles

                        WHERE persistence_case_id = ?
                        """,
                        Integer.class,
                        persistenceCaseId
                );

        return count != null
                &&
                count > 0;
    }

    public void createLineage(
            UUID lineageId,
            String lineageNumber,
            CapitalFlywheelCandidateResponse candidate,
            CapitalFlywheelLineageInput input,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_flywheel_lineages (
                    id,
                    lineage_number,
                    root_persistence_case_id,
                    root_persistence_case_number,
                    root_target_value_case_id,
                    root_target_value_case_number,
                    root_target_initiative_title,
                    original_capital_amount,
                    currency,
                    root_fiscal_year,
                    maximum_cycle_count,
                    minimum_marginal_value_multiple,
                    minimum_cycle_efficiency_retention_pct,
                    diminishing_return_tolerance_pct,
                    lineage_owner_user_id,
                    lineage_owner_name_snapshot,
                    lineage_objective,
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
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'READY_FOR_REVIEW',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                lineageId,
                lineageNumber,

                candidate.persistenceCaseId(),
                candidate.persistenceCaseNumber(),

                candidate.targetValueCaseId(),
                candidate.targetValueCaseNumber(),
                candidate.targetInitiativeTitle(),

                candidate.redeployedCapitalAmount(),

                candidate.currency(),
                candidate.fiscalYear(),

                input.maximumCycleCount(),

                input.minimumMarginalValueMultiple(),
                input.minimumCycleEfficiencyRetentionPct(),
                input.diminishingReturnTolerancePct(),

                input.lineageOwnerUserId(),
                ownerName,

                input.lineageObjective()
                        .trim(),

                currentUserId
        );
    }

    public void createCycle(
            UUID cycleId,
            UUID lineageId,
            int cycleIndex,
            CapitalFlywheelCandidateResponse candidate,
            String relationshipRationale,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_flywheel_cycles (
                    id,
                    lineage_id,
                    cycle_index,
                    persistence_case_id,
                    persistence_case_number,
                    source_performance_case_number,
                    redeployment_number,
                    recycling_source_number,
                    target_value_case_id,
                    target_value_case_number,
                    target_initiative_title,
                    fiscal_year,
                    redeployed_capital_amount,
                    baseline_net_value_amount,
                    projected_net_value_amount,
                    projected_horizon_value_amount,
                    projected_roi_pct,
                    value_persistence_pct,
                    efficiency_retention_pct,
                    capital_efficiency_multiple,
                    compounding_value_amount,
                    decayed_value_amount,
                    persistence_health,
                    relationship_rationale,
                    added_by_user_id,
                    added_at
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
                    CURRENT_TIMESTAMP
                )
                """,
                cycleId,
                lineageId,
                cycleIndex,

                candidate.persistenceCaseId(),
                candidate.persistenceCaseNumber(),

                candidate.sourcePerformanceCaseNumber(),
                candidate.redeploymentNumber(),
                candidate.recyclingSourceNumber(),

                candidate.targetValueCaseId(),
                candidate.targetValueCaseNumber(),
                candidate.targetInitiativeTitle(),

                candidate.fiscalYear(),

                candidate.redeployedCapitalAmount(),

                candidate.baselineNetValueAmount(),
                candidate.projectedNetValueAmount(),
                candidate.projectedHorizonValueAmount(),
                candidate.projectedRoiPct(),

                candidate.valuePersistencePct(),
                candidate.efficiencyRetentionPct(),
                candidate.capitalEfficiencyMultiple(),

                candidate.compoundingValueAmount(),
                candidate.decayedValueAmount(),

                candidate.persistenceHealth()
                        .name(),

                relationshipRationale.trim(),

                currentUserId
        );
    }

    public LineageRow findLineage(
            UUID lineageId
    ) {
        return jdbcTemplate.query(
                lineageSql()
                        + """
                        WHERE flywheel_lineage.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapLineage(
                                resultSet
                        ),
                lineageId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<LineageRow> lineages() {
        return jdbcTemplate.query(
                lineageSql()
                        + """
                        ORDER BY
                            CASE flywheel_lineage.status
                                WHEN 'READY_FOR_REVIEW'
                                THEN 1
                                WHEN 'APPROVED_FOR_NEXT_CYCLE'
                                THEN 2
                                WHEN 'STOPPED'
                                THEN 3
                                ELSE 4
                            END,

                            flywheel_lineage.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapLineage(
                                resultSet
                        )
        );
    }

    public List<CycleRow> cycles(
            UUID lineageId
    ) {
        return jdbcTemplate.query(
                cycleSql()
                        + """
                        WHERE flywheel_cycle.lineage_id = ?

                        ORDER BY
                            flywheel_cycle.cycle_index
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCycle(
                                resultSet
                        ),
                lineageId
        );
    }

    public CycleRow latestCycle(
            UUID lineageId
    ) {
        return jdbcTemplate.query(
                cycleSql()
                        + """
                        WHERE flywheel_cycle.lineage_id = ?

                        ORDER BY
                            flywheel_cycle.cycle_index DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCycle(
                                resultSet
                        ),
                lineageId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void markReadyForReview(
            UUID lineageId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_flywheel_lineages

                SET
                    status = 'READY_FOR_REVIEW',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'APPROVED_FOR_NEXT_CYCLE'
                """,
                lineageId
        );
    }

    public void createReview(
            UUID reviewId,
            UUID lineageId,
            UUID latestCycleId,
            CapitalFlywheelMetricResult metric,
            CapitalFlywheelReviewInput input,
            boolean overrideFlag,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_flywheel_reviews (
                    id,
                    lineage_id,
                    latest_cycle_id,
                    cycle_count,
                    recommendation,
                    decision,
                    override_flag,
                    diminishing_returns,
                    cumulative_projected_net_value_amount,
                    cumulative_compounding_value_amount,
                    cumulative_decayed_value_amount,
                    cumulative_value_multiple,
                    latest_marginal_value_multiple,
                    latest_marginal_net_value_retention_pct,
                    latest_cycle_efficiency_retention_pct,
                    latest_cycle_value_persistence_pct,
                    latest_cycle_projected_roi_pct,
                    flywheel_health,
                    decision_note,
                    reviewed_by_user_id,
                    reviewed_at
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
                reviewId,
                lineageId,
                latestCycleId,

                metric.cycleCount(),

                metric.recommendation()
                        .name(),

                input.decision()
                        .name(),

                overrideFlag,
                metric.diminishingReturns(),

                metric.cumulativeProjectedNetValueAmount(),
                metric.cumulativeCompoundingValueAmount(),
                metric.cumulativeDecayedValueAmount(),

                metric.cumulativeValueMultiple(),
                metric.latestMarginalValueMultiple(),
                metric.latestMarginalNetValueRetentionPct(),

                metric.latestCycleEfficiencyRetentionPct(),
                metric.latestCycleValuePersistencePct(),
                metric.latestCycleProjectedRoiPct(),

                metric.health()
                        .name(),

                input.decisionNote()
                        .trim(),

                currentUserId
        );
    }

    public List<ReviewRow> reviews(
            UUID lineageId
    ) {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        WHERE flywheel_review.lineage_id = ?

                        ORDER BY
                            flywheel_review.reviewed_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapReview(
                                resultSet
                        ),
                lineageId
        );
    }

    public void markApprovedForNextCycle(
            UUID lineageId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_flywheel_lineages

                SET
                    status = 'APPROVED_FOR_NEXT_CYCLE',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_REVIEW'
                """,
                lineageId
        );
    }

    public void markStopped(
            UUID lineageId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_flywheel_lineages

                SET
                    status = 'STOPPED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_REVIEW'
                """,
                lineageId
        );
    }

    public void closeLineage(
            UUID lineageId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_capital_flywheel_lineages

                SET
                    status = 'CLOSED',
                    close_note = ?,
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'STOPPED'
                """,
                note.trim(),
                currentUserId,
                lineageId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            CapitalFlywheelSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_flywheel_snapshots (
                    id,
                    snapshot_number,
                    lineage_count,
                    review_pending_lineage_count,
                    approved_next_cycle_lineage_count,
                    stopped_lineage_count,
                    total_cycle_count,
                    total_original_capital_amount,
                    total_cumulative_projected_net_value_amount,
                    total_compounding_value_amount,
                    total_decayed_value_amount,
                    average_cumulative_value_multiple,
                    average_latest_marginal_value_multiple,
                    diminishing_return_lineage_count,
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
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,

                summary.lineageCount(),

                summary.reviewPendingLineageCount(),
                summary.approvedNextCycleLineageCount(),
                summary.stoppedLineageCount(),

                summary.totalCycleCount(),

                summary.totalOriginalCapitalAmount(),
                summary.totalCumulativeProjectedNetValueAmount(),

                summary.totalCompoundingValueAmount(),
                summary.totalDecayedValueAmount(),

                summary.averageCumulativeValueMultiple(),
                summary.averageLatestMarginalValueMultiple(),

                summary.diminishingReturnLineageCount(),

                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            CapitalFlywheelLineageResponse lineage
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_capital_flywheel_snapshot_items (
                    id,
                    snapshot_id,
                    lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    currency,
                    lineage_status,
                    cycle_count,
                    original_capital_amount,
                    cumulative_projected_net_value_amount,
                    cumulative_compounding_value_amount,
                    cumulative_decayed_value_amount,
                    cumulative_value_multiple,
                    latest_marginal_value_multiple,
                    latest_marginal_net_value_retention_pct,
                    diminishing_returns,
                    flywheel_health,
                    recommendation,
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

                lineage.id(),
                lineage.lineageNumber(),
                lineage.rootTargetInitiativeTitle(),
                lineage.currency(),

                lineage.status()
                        .name(),

                lineage.cycleCount(),

                lineage.originalCapitalAmount(),

                lineage.cumulativeProjectedNetValueAmount(),
                lineage.cumulativeCompoundingValueAmount(),
                lineage.cumulativeDecayedValueAmount(),

                lineage.cumulativeValueMultiple(),
                lineage.latestMarginalValueMultiple(),
                lineage.latestMarginalNetValueRetentionPct(),

                lineage.diminishingReturns(),

                lineage.flywheelHealth()
                        .name(),

                lineage.recommendation()
                        .name()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE flywheel_snapshot.id = ?
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

    public List<SnapshotRow> snapshots() {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        ORDER BY
                            flywheel_snapshot.captured_at DESC

                        LIMIT 100
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        )
        );
    }

    public List<SnapshotItemRow> snapshotItems(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    currency,
                    lineage_status,
                    cycle_count,
                    original_capital_amount,
                    cumulative_projected_net_value_amount,
                    cumulative_compounding_value_amount,
                    cumulative_decayed_value_amount,
                    cumulative_value_multiple,
                    latest_marginal_value_multiple,
                    latest_marginal_net_value_retention_pct,
                    diminishing_returns,
                    flywheel_health,
                    recommendation

                FROM procurement_capital_flywheel_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    diminishing_returns DESC,
                    cumulative_value_multiple,
                    lineage_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "lineage_id",
                                        UUID.class
                                ),

                                resultSet.getString(
                                        "lineage_number"
                                ),

                                resultSet.getString(
                                        "root_target_initiative_title"
                                ),

                                resultSet.getString(
                                        "currency"
                                ),

                                CapitalFlywheelStatus.valueOf(
                                        resultSet.getString(
                                                "lineage_status"
                                        )
                                ),

                                resultSet.getInt(
                                        "cycle_count"
                                ),

                                resultSet.getBigDecimal(
                                        "original_capital_amount"
                                ),

                                resultSet.getBigDecimal(
                                        "cumulative_projected_net_value_amount"
                                ),

                                resultSet.getBigDecimal(
                                        "cumulative_compounding_value_amount"
                                ),

                                resultSet.getBigDecimal(
                                        "cumulative_decayed_value_amount"
                                ),

                                resultSet.getBigDecimal(
                                        "cumulative_value_multiple"
                                ),

                                resultSet.getBigDecimal(
                                        "latest_marginal_value_multiple"
                                ),

                                resultSet.getBigDecimal(
                                        "latest_marginal_net_value_retention_pct"
                                ),

                                resultSet.getBoolean(
                                        "diminishing_returns"
                                ),

                                CapitalFlywheelHealth.valueOf(
                                        resultSet.getString(
                                                "flywheel_health"
                                        )
                                ),

                                CapitalFlywheelRecommendation.valueOf(
                                        resultSet.getString(
                                                "recommendation"
                                        )
                                )
                        ),
                snapshotId
        );
    }

    private String lineageSql() {
        return """
                SELECT
                    flywheel_lineage.id,
                    flywheel_lineage.lineage_number,

                    flywheel_lineage.root_persistence_case_id,
                    flywheel_lineage.root_persistence_case_number,

                    flywheel_lineage.root_target_value_case_id,
                    flywheel_lineage.root_target_value_case_number,
                    flywheel_lineage.root_target_initiative_title,

                    flywheel_lineage.original_capital_amount,

                    flywheel_lineage.currency,
                    flywheel_lineage.root_fiscal_year,

                    flywheel_lineage.maximum_cycle_count,

                    flywheel_lineage.minimum_marginal_value_multiple,
                    flywheel_lineage.minimum_cycle_efficiency_retention_pct,
                    flywheel_lineage.diminishing_return_tolerance_pct,

                    flywheel_lineage.lineage_owner_user_id,
                    flywheel_lineage.lineage_owner_name_snapshot,
                    flywheel_lineage.lineage_objective,

                    flywheel_lineage.status,

                    flywheel_lineage.close_note,

                    closer.full_name
                        AS closed_by_name,

                    flywheel_lineage.closed_at,
                    flywheel_lineage.created_at,
                    flywheel_lineage.updated_at,
                    flywheel_lineage.version

                FROM procurement_capital_flywheel_lineages
                    flywheel_lineage

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       flywheel_lineage.closed_by_user_id

                """;
    }

    private String cycleSql() {
        return """
                SELECT
                    flywheel_cycle.id,
                    flywheel_cycle.lineage_id,
                    flywheel_cycle.cycle_index,

                    flywheel_cycle.persistence_case_id,
                    flywheel_cycle.persistence_case_number,

                    flywheel_cycle.source_performance_case_number,
                    flywheel_cycle.redeployment_number,
                    flywheel_cycle.recycling_source_number,

                    flywheel_cycle.target_value_case_id,
                    flywheel_cycle.target_value_case_number,
                    flywheel_cycle.target_initiative_title,

                    flywheel_cycle.fiscal_year,

                    flywheel_cycle.redeployed_capital_amount,

                    flywheel_cycle.baseline_net_value_amount,
                    flywheel_cycle.projected_net_value_amount,
                    flywheel_cycle.projected_horizon_value_amount,
                    flywheel_cycle.projected_roi_pct,

                    flywheel_cycle.value_persistence_pct,
                    flywheel_cycle.efficiency_retention_pct,
                    flywheel_cycle.capital_efficiency_multiple,

                    flywheel_cycle.compounding_value_amount,
                    flywheel_cycle.decayed_value_amount,

                    flywheel_cycle.persistence_health,

                    flywheel_cycle.relationship_rationale,

                    user_account.full_name
                        AS added_by_name,

                    flywheel_cycle.added_at

                FROM procurement_capital_flywheel_cycles
                    flywheel_cycle

                JOIN app_users
                    user_account
                    ON user_account.id =
                       flywheel_cycle.added_by_user_id

                """;
    }

    private String reviewSql() {
        return """
                SELECT
                    flywheel_review.id,
                    flywheel_review.lineage_id,
                    flywheel_review.latest_cycle_id,

                    flywheel_review.cycle_count,

                    flywheel_review.recommendation,
                    flywheel_review.decision,

                    flywheel_review.override_flag,
                    flywheel_review.diminishing_returns,

                    flywheel_review.cumulative_projected_net_value_amount,
                    flywheel_review.cumulative_compounding_value_amount,
                    flywheel_review.cumulative_decayed_value_amount,

                    flywheel_review.cumulative_value_multiple,
                    flywheel_review.latest_marginal_value_multiple,
                    flywheel_review.latest_marginal_net_value_retention_pct,

                    flywheel_review.latest_cycle_efficiency_retention_pct,
                    flywheel_review.latest_cycle_value_persistence_pct,
                    flywheel_review.latest_cycle_projected_roi_pct,

                    flywheel_review.flywheel_health,

                    flywheel_review.decision_note,

                    reviewer.full_name
                        AS reviewed_by_name,

                    flywheel_review.reviewed_at

                FROM procurement_capital_flywheel_reviews
                    flywheel_review

                JOIN app_users
                    reviewer
                    ON reviewer.id =
                       flywheel_review.reviewed_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    flywheel_snapshot.id,
                    flywheel_snapshot.snapshot_number,

                    flywheel_snapshot.lineage_count,
                    flywheel_snapshot.review_pending_lineage_count,
                    flywheel_snapshot.approved_next_cycle_lineage_count,
                    flywheel_snapshot.stopped_lineage_count,

                    flywheel_snapshot.total_cycle_count,

                    flywheel_snapshot.total_original_capital_amount,
                    flywheel_snapshot.total_cumulative_projected_net_value_amount,
                    flywheel_snapshot.total_compounding_value_amount,
                    flywheel_snapshot.total_decayed_value_amount,

                    flywheel_snapshot.average_cumulative_value_multiple,
                    flywheel_snapshot.average_latest_marginal_value_multiple,

                    flywheel_snapshot.diminishing_return_lineage_count,

                    user_account.full_name
                        AS captured_by_name,

                    flywheel_snapshot.captured_at

                FROM procurement_capital_flywheel_snapshots
                    flywheel_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       flywheel_snapshot.captured_by_user_id

                """;
    }

    private LineageRow mapLineage(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new LineageRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),

                resultSet.getString(
                        "lineage_number"
                ),

                resultSet.getObject(
                        "root_persistence_case_id",
                        UUID.class
                ),

                resultSet.getString(
                        "root_persistence_case_number"
                ),

                resultSet.getObject(
                        "root_target_value_case_id",
                        UUID.class
                ),

                resultSet.getString(
                        "root_target_value_case_number"
                ),

                resultSet.getString(
                        "root_target_initiative_title"
                ),

                resultSet.getBigDecimal(
                        "original_capital_amount"
                ),

                resultSet.getString(
                        "currency"
                ),

                resultSet.getInt(
                        "root_fiscal_year"
                ),

                resultSet.getInt(
                        "maximum_cycle_count"
                ),

                resultSet.getBigDecimal(
                        "minimum_marginal_value_multiple"
                ),

                resultSet.getBigDecimal(
                        "minimum_cycle_efficiency_retention_pct"
                ),

                resultSet.getBigDecimal(
                        "diminishing_return_tolerance_pct"
                ),

                resultSet.getObject(
                        "lineage_owner_user_id",
                        UUID.class
                ),

                resultSet.getString(
                        "lineage_owner_name_snapshot"
                ),

                resultSet.getString(
                        "lineage_objective"
                ),

                CapitalFlywheelStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),

                resultSet.getString(
                        "close_note"
                ),

                resultSet.getString(
                        "closed_by_name"
                ),

                instant(
                        resultSet,
                        "closed_at"
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

    private CycleRow mapCycle(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new CycleRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),

                resultSet.getObject(
                        "lineage_id",
                        UUID.class
                ),

                resultSet.getInt(
                        "cycle_index"
                ),

                resultSet.getObject(
                        "persistence_case_id",
                        UUID.class
                ),

                resultSet.getString(
                        "persistence_case_number"
                ),

                resultSet.getString(
                        "source_performance_case_number"
                ),

                resultSet.getString(
                        "redeployment_number"
                ),

                resultSet.getString(
                        "recycling_source_number"
                ),

                resultSet.getObject(
                        "target_value_case_id",
                        UUID.class
                ),

                resultSet.getString(
                        "target_value_case_number"
                ),

                resultSet.getString(
                        "target_initiative_title"
                ),

                resultSet.getInt(
                        "fiscal_year"
                ),

                resultSet.getBigDecimal(
                        "redeployed_capital_amount"
                ),

                resultSet.getBigDecimal(
                        "baseline_net_value_amount"
                ),

                resultSet.getBigDecimal(
                        "projected_net_value_amount"
                ),

                resultSet.getBigDecimal(
                        "projected_horizon_value_amount"
                ),

                resultSet.getBigDecimal(
                        "projected_roi_pct"
                ),

                resultSet.getBigDecimal(
                        "value_persistence_pct"
                ),

                resultSet.getBigDecimal(
                        "efficiency_retention_pct"
                ),

                resultSet.getBigDecimal(
                        "capital_efficiency_multiple"
                ),

                resultSet.getBigDecimal(
                        "compounding_value_amount"
                ),

                resultSet.getBigDecimal(
                        "decayed_value_amount"
                ),

                ReinvestmentPersistenceHealth.valueOf(
                        resultSet.getString(
                                "persistence_health"
                        )
                ),

                resultSet.getString(
                        "relationship_rationale"
                ),

                resultSet.getString(
                        "added_by_name"
                ),

                resultSet.getTimestamp(
                        "added_at"
                )
                        .toInstant()
        );
    }

    private ReviewRow mapReview(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ReviewRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),

                resultSet.getObject(
                        "lineage_id",
                        UUID.class
                ),

                resultSet.getObject(
                        "latest_cycle_id",
                        UUID.class
                ),

                resultSet.getInt(
                        "cycle_count"
                ),

                CapitalFlywheelRecommendation.valueOf(
                        resultSet.getString(
                                "recommendation"
                        )
                ),

                CapitalFlywheelReviewDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),

                resultSet.getBoolean(
                        "override_flag"
                ),

                resultSet.getBoolean(
                        "diminishing_returns"
                ),

                resultSet.getBigDecimal(
                        "cumulative_projected_net_value_amount"
                ),

                resultSet.getBigDecimal(
                        "cumulative_compounding_value_amount"
                ),

                resultSet.getBigDecimal(
                        "cumulative_decayed_value_amount"
                ),

                resultSet.getBigDecimal(
                        "cumulative_value_multiple"
                ),

                resultSet.getBigDecimal(
                        "latest_marginal_value_multiple"
                ),

                resultSet.getBigDecimal(
                        "latest_marginal_net_value_retention_pct"
                ),

                resultSet.getBigDecimal(
                        "latest_cycle_efficiency_retention_pct"
                ),

                resultSet.getBigDecimal(
                        "latest_cycle_value_persistence_pct"
                ),

                resultSet.getBigDecimal(
                        "latest_cycle_projected_roi_pct"
                ),

                CapitalFlywheelHealth.valueOf(
                        resultSet.getString(
                                "flywheel_health"
                        )
                ),

                resultSet.getString(
                        "decision_note"
                ),

                resultSet.getString(
                        "reviewed_by_name"
                ),

                resultSet.getTimestamp(
                        "reviewed_at"
                )
                        .toInstant()
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

                resultSet.getInt(
                        "lineage_count"
                ),

                resultSet.getInt(
                        "review_pending_lineage_count"
                ),

                resultSet.getInt(
                        "approved_next_cycle_lineage_count"
                ),

                resultSet.getInt(
                        "stopped_lineage_count"
                ),

                resultSet.getInt(
                        "total_cycle_count"
                ),

                resultSet.getBigDecimal(
                        "total_original_capital_amount"
                ),

                resultSet.getBigDecimal(
                        "total_cumulative_projected_net_value_amount"
                ),

                resultSet.getBigDecimal(
                        "total_compounding_value_amount"
                ),

                resultSet.getBigDecimal(
                        "total_decayed_value_amount"
                ),

                resultSet.getBigDecimal(
                        "average_cumulative_value_multiple"
                ),

                resultSet.getBigDecimal(
                        "average_latest_marginal_value_multiple"
                ),

                resultSet.getInt(
                        "diminishing_return_lineage_count"
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

    public record LineageRow(
            UUID id,
            String lineageNumber,

            UUID rootPersistenceCaseId,
            String rootPersistenceCaseNumber,

            UUID rootTargetValueCaseId,
            String rootTargetValueCaseNumber,
            String rootTargetInitiativeTitle,

            BigDecimal originalCapitalAmount,

            String currency,
            int rootFiscalYear,

            int maximumCycleCount,

            BigDecimal minimumMarginalValueMultiple,
            BigDecimal minimumCycleEfficiencyRetentionPct,
            BigDecimal diminishingReturnTolerancePct,

            UUID lineageOwnerUserId,
            String lineageOwnerName,
            String lineageObjective,

            CapitalFlywheelStatus status,

            String closeNote,
            String closedByName,
            Instant closedAt,

            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record CycleRow(
            UUID id,
            UUID lineageId,
            int cycleIndex,

            UUID persistenceCaseId,
            String persistenceCaseNumber,

            String sourcePerformanceCaseNumber,
            String redeploymentNumber,
            String recyclingSourceNumber,

            UUID targetValueCaseId,
            String targetValueCaseNumber,
            String targetInitiativeTitle,

            int fiscalYear,

            BigDecimal redeployedCapitalAmount,

            BigDecimal baselineNetValueAmount,
            BigDecimal projectedNetValueAmount,
            BigDecimal projectedHorizonValueAmount,
            BigDecimal projectedRoiPct,

            BigDecimal valuePersistencePct,
            BigDecimal efficiencyRetentionPct,
            BigDecimal capitalEfficiencyMultiple,

            BigDecimal compoundingValueAmount,
            BigDecimal decayedValueAmount,

            ReinvestmentPersistenceHealth persistenceHealth,

            String relationshipRationale,
            String addedByName,
            Instant addedAt
    ) {
    }

    public record ReviewRow(
            UUID id,
            UUID lineageId,
            UUID latestCycleId,

            int cycleCount,

            CapitalFlywheelRecommendation recommendation,
            CapitalFlywheelReviewDecision decision,

            boolean overrideFlag,
            boolean diminishingReturns,

            BigDecimal cumulativeProjectedNetValueAmount,
            BigDecimal cumulativeCompoundingValueAmount,
            BigDecimal cumulativeDecayedValueAmount,

            BigDecimal cumulativeValueMultiple,
            BigDecimal latestMarginalValueMultiple,
            BigDecimal latestMarginalNetValueRetentionPct,

            BigDecimal latestCycleEfficiencyRetentionPct,
            BigDecimal latestCycleValuePersistencePct,
            BigDecimal latestCycleProjectedRoiPct,

            CapitalFlywheelHealth flywheelHealth,

            String decisionNote,
            String reviewedByName,
            Instant reviewedAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,

            int lineageCount,

            int reviewPendingLineageCount,
            int approvedNextCycleLineageCount,
            int stoppedLineageCount,

            int totalCycleCount,

            BigDecimal totalOriginalCapitalAmount,
            BigDecimal totalCumulativeProjectedNetValueAmount,
            BigDecimal totalCompoundingValueAmount,
            BigDecimal totalDecayedValueAmount,

            BigDecimal averageCumulativeValueMultiple,
            BigDecimal averageLatestMarginalValueMultiple,

            int diminishingReturnLineageCount,

            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID lineageId,
            String lineageNumber,
            String rootTargetInitiativeTitle,
            String currency,

            CapitalFlywheelStatus lineageStatus,

            int cycleCount,

            BigDecimal originalCapitalAmount,

            BigDecimal cumulativeProjectedNetValueAmount,
            BigDecimal cumulativeCompoundingValueAmount,
            BigDecimal cumulativeDecayedValueAmount,

            BigDecimal cumulativeValueMultiple,
            BigDecimal latestMarginalValueMultiple,
            BigDecimal latestMarginalNetValueRetentionPct,

            boolean diminishingReturns,

            CapitalFlywheelHealth flywheelHealth,
            CapitalFlywheelRecommendation recommendation
    ) {
    }
}
