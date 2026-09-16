package com.procureiq.flywheelstrategy;

import com.procureiq.capitalflywheel.CapitalFlywheelHealth;
import com.procureiq.capitalflywheel.CapitalFlywheelRecommendation;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class FlywheelStrategyRepository {

    private final JdbcTemplate jdbcTemplate;

    public FlywheelStrategyRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextPortfolioSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_flywheel_strategy_portfolio_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_flywheel_strategy_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<FlywheelStrategyUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role

                FROM app_users

                WHERE active = TRUE
                AND role <> 'REQUESTER'

                ORDER BY full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new FlywheelStrategyUserOptionResponse(
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

    public void createPortfolio(
            UUID portfolioId,
            String portfolioNumber,
            FlywheelStrategyPortfolioInput input,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_strategy_portfolios (
                    id,
                    portfolio_number,
                    title,
                    currency,
                    fiscal_year,
                    capital_capacity_amount,
                    portfolio_owner_user_id,
                    portfolio_owner_name_snapshot,
                    strategic_objective,
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
                    'DRAFT',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                portfolioId,
                portfolioNumber,
                input.title().trim(),
                input.currency().trim().toUpperCase(),
                input.fiscalYear(),
                input.capitalCapacityAmount(),
                input.portfolioOwnerUserId(),
                ownerName,
                input.strategicObjective().trim(),
                currentUserId
        );
    }

    public PortfolioRow findPortfolio(
            UUID portfolioId
    ) {
        return jdbcTemplate.query(
                portfolioSql()
                        + """
                        WHERE strategy_portfolio.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPortfolio(
                                resultSet
                        ),
                portfolioId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<PortfolioRow> portfolios() {
        return jdbcTemplate.query(
                portfolioSql()
                        + """
                        ORDER BY
                            CASE strategy_portfolio.status
                                WHEN 'IN_REVIEW' THEN 1
                                WHEN 'DRAFT' THEN 2
                                WHEN 'APPROVED' THEN 3
                                ELSE 4
                            END,
                            strategy_portfolio.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPortfolio(
                                resultSet
                        )
        );
    }

    public boolean lineageInOpenPortfolio(
            UUID lineageId
    ) {
        Integer count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)

                        FROM procurement_flywheel_strategy_items
                            strategy_item

                        JOIN procurement_flywheel_strategy_portfolios
                            strategy_portfolio
                            ON strategy_portfolio.id =
                               strategy_item.portfolio_id

                        WHERE strategy_item.flywheel_lineage_id = ?
                        AND strategy_portfolio.status <> 'CLOSED'
                        """,
                        Integer.class,
                        lineageId
                );

        return count != null
                &&
                count > 0;
    }

    public void createItem(
            UUID itemId,
            UUID portfolioId,
            FlywheelStrategyCandidateResponse candidate,
            BigDecimal proposedCapacityAmount,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_strategy_items (
                    id,
                    portfolio_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_value_case_id,
                    root_target_value_case_number,
                    root_target_initiative_title,
                    lineage_root_fiscal_year,
                    lineage_cycle_count,
                    lineage_original_capital_amount,
                    reference_next_cycle_capital_amount,
                    proposed_capacity_amount,
                    cumulative_projected_net_value_amount,
                    cumulative_compounding_value_amount,
                    cumulative_decayed_value_amount,
                    cumulative_value_multiple,
                    latest_marginal_value_multiple,
                    latest_marginal_net_value_retention_pct,
                    diminishing_returns,
                    flywheel_health,
                    step66_recommendation,
                    priority_score,
                    advisory_recommendation,
                    decision,
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
                    'PENDING',
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                itemId,
                portfolioId,

                candidate.flywheelLineageId(),
                candidate.lineageNumber(),

                candidate.rootTargetValueCaseId(),
                candidate.rootTargetValueCaseNumber(),
                candidate.rootTargetInitiativeTitle(),

                candidate.rootFiscalYear(),
                candidate.cycleCount(),

                candidate.lineageOriginalCapitalAmount(),
                candidate.referenceNextCycleCapitalAmount(),
                proposedCapacityAmount,

                candidate.cumulativeProjectedNetValueAmount(),
                candidate.cumulativeCompoundingValueAmount(),
                candidate.cumulativeDecayedValueAmount(),

                candidate.cumulativeValueMultiple(),
                candidate.latestMarginalValueMultiple(),
                candidate.latestMarginalNetValueRetentionPct(),

                candidate.diminishingReturns(),

                candidate.flywheelHealth().name(),
                candidate.step66Recommendation().name(),

                candidate.priorityScore(),
                candidate.advisoryRecommendation().name(),

                currentUserId
        );
    }

    public ItemRow findItem(
            UUID itemId
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE strategy_item.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        ),
                itemId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ItemRow> items(
            UUID portfolioId
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE strategy_item.portfolio_id = ?

                        ORDER BY
                            strategy_item.priority_score DESC,
                            strategy_item.lineage_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        ),
                portfolioId
        );
    }

    public int markInReview(
            UUID portfolioId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_strategy_portfolios

                SET
                    status = 'IN_REVIEW',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'DRAFT'
                """,
                portfolioId
        );
    }

    public int decideItem(
            UUID itemId,
            FlywheelStrategyDecisionInput input,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_strategy_items

                SET
                    decision = ?,
                    decision_note = ?,
                    decided_by_user_id = ?,
                    decided_at = CURRENT_TIMESTAMP

                WHERE id = ?
                AND decision = 'PENDING'
                """,
                input.decision().name(),
                input.decisionNote().trim(),
                currentUserId,
                itemId
        );
    }

    public int approvePortfolio(
            UUID portfolioId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_strategy_portfolios

                SET
                    status = 'APPROVED',
                    approval_note = ?,
                    approved_by_user_id = ?,
                    approved_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'IN_REVIEW'
                """,
                note.trim(),
                currentUserId,
                portfolioId
        );
    }

    public int closePortfolio(
            UUID portfolioId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_strategy_portfolios

                SET
                    status = 'CLOSED',
                    close_note = ?,
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'APPROVED'
                """,
                note.trim(),
                currentUserId,
                portfolioId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            FlywheelStrategyPortfolioResponse portfolio,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_strategy_snapshots (
                    id,
                    snapshot_number,
                    portfolio_id,
                    portfolio_number,
                    currency,
                    fiscal_year,
                    portfolio_status,
                    capital_capacity_amount,
                    item_count,
                    prioritize_count,
                    hold_count,
                    exit_count,
                    pending_count,
                    prioritized_capacity_amount,
                    remaining_capacity_amount,
                    capacity_utilization_pct,
                    average_priority_score,
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

                portfolio.id(),
                portfolio.portfolioNumber(),

                portfolio.currency(),
                portfolio.fiscalYear(),

                portfolio.status().name(),

                portfolio.capitalCapacityAmount(),

                portfolio.itemCount(),
                portfolio.prioritizeCount(),
                portfolio.holdCount(),
                portfolio.exitCount(),
                portfolio.pendingCount(),

                portfolio.prioritizedCapacityAmount(),
                portfolio.remainingCapacityAmount(),
                portfolio.capacityUtilizationPct(),
                portfolio.averagePriorityScore(),

                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            FlywheelStrategyItemResponse item
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_strategy_snapshot_items (
                    id,
                    snapshot_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    proposed_capacity_amount,
                    cumulative_projected_net_value_amount,
                    cumulative_value_multiple,
                    latest_marginal_value_multiple,
                    latest_marginal_net_value_retention_pct,
                    diminishing_returns,
                    flywheel_health,
                    step66_recommendation,
                    priority_score,
                    advisory_recommendation,
                    decision,
                    decision_note,
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

                item.flywheelLineageId(),
                item.lineageNumber(),
                item.rootTargetInitiativeTitle(),

                item.proposedCapacityAmount(),
                item.cumulativeProjectedNetValueAmount(),

                item.cumulativeValueMultiple(),
                item.latestMarginalValueMultiple(),
                item.latestMarginalNetValueRetentionPct(),

                item.diminishingReturns(),

                item.flywheelHealth().name(),
                item.step66Recommendation().name(),

                item.priorityScore(),
                item.advisoryRecommendation().name(),

                item.decision().name(),
                item.decisionNote()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE strategy_snapshot.id = ?
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
                            strategy_snapshot.captured_at DESC

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

    public List<SnapshotRow> snapshotsForPortfolio(
            UUID portfolioId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE strategy_snapshot.portfolio_id = ?

                        ORDER BY
                            strategy_snapshot.captured_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        ),
                portfolioId
        );
    }

    public List<SnapshotItemRow> snapshotItems(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    proposed_capacity_amount,
                    cumulative_projected_net_value_amount,
                    cumulative_value_multiple,
                    latest_marginal_value_multiple,
                    latest_marginal_net_value_retention_pct,
                    diminishing_returns,
                    flywheel_health,
                    step66_recommendation,
                    priority_score,
                    advisory_recommendation,
                    decision,
                    decision_note

                FROM procurement_flywheel_strategy_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    priority_score DESC,
                    lineage_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "flywheel_lineage_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "lineage_number"
                                ),
                                resultSet.getString(
                                        "root_target_initiative_title"
                                ),
                                resultSet.getBigDecimal(
                                        "proposed_capacity_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "cumulative_projected_net_value_amount"
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
                                                "step66_recommendation"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "priority_score"
                                ),
                                FlywheelStrategyAdvisory.valueOf(
                                        resultSet.getString(
                                                "advisory_recommendation"
                                        )
                                ),
                                FlywheelStrategyDecision.valueOf(
                                        resultSet.getString(
                                                "decision"
                                        )
                                ),
                                resultSet.getString(
                                        "decision_note"
                                )
                        ),
                snapshotId
        );
    }

    private String portfolioSql() {
        return """
                SELECT
                    strategy_portfolio.id,
                    strategy_portfolio.portfolio_number,
                    strategy_portfolio.title,
                    strategy_portfolio.currency,
                    strategy_portfolio.fiscal_year,
                    strategy_portfolio.capital_capacity_amount,
                    strategy_portfolio.portfolio_owner_user_id,
                    strategy_portfolio.portfolio_owner_name_snapshot,
                    strategy_portfolio.strategic_objective,
                    strategy_portfolio.status,
                    strategy_portfolio.approval_note,

                    approver.full_name
                        AS approved_by_name,

                    strategy_portfolio.approved_at,
                    strategy_portfolio.close_note,

                    closer.full_name
                        AS closed_by_name,

                    strategy_portfolio.closed_at,
                    strategy_portfolio.created_at,
                    strategy_portfolio.updated_at,
                    strategy_portfolio.version

                FROM procurement_flywheel_strategy_portfolios
                    strategy_portfolio

                LEFT JOIN app_users
                    approver
                    ON approver.id =
                       strategy_portfolio.approved_by_user_id

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       strategy_portfolio.closed_by_user_id

                """;
    }

    private String itemSql() {
        return """
                SELECT
                    strategy_item.id,
                    strategy_item.portfolio_id,
                    strategy_item.flywheel_lineage_id,
                    strategy_item.lineage_number,
                    strategy_item.root_target_value_case_id,
                    strategy_item.root_target_value_case_number,
                    strategy_item.root_target_initiative_title,
                    strategy_item.lineage_root_fiscal_year,
                    strategy_item.lineage_cycle_count,
                    strategy_item.lineage_original_capital_amount,
                    strategy_item.reference_next_cycle_capital_amount,
                    strategy_item.proposed_capacity_amount,
                    strategy_item.cumulative_projected_net_value_amount,
                    strategy_item.cumulative_compounding_value_amount,
                    strategy_item.cumulative_decayed_value_amount,
                    strategy_item.cumulative_value_multiple,
                    strategy_item.latest_marginal_value_multiple,
                    strategy_item.latest_marginal_net_value_retention_pct,
                    strategy_item.diminishing_returns,
                    strategy_item.flywheel_health,
                    strategy_item.step66_recommendation,
                    strategy_item.priority_score,
                    strategy_item.advisory_recommendation,
                    strategy_item.decision,
                    strategy_item.decision_note,

                    decider.full_name
                        AS decided_by_name,

                    strategy_item.decided_at,

                    adder.full_name
                        AS added_by_name,

                    strategy_item.added_at

                FROM procurement_flywheel_strategy_items
                    strategy_item

                LEFT JOIN app_users
                    decider
                    ON decider.id =
                       strategy_item.decided_by_user_id

                JOIN app_users
                    adder
                    ON adder.id =
                       strategy_item.added_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    strategy_snapshot.id,
                    strategy_snapshot.snapshot_number,
                    strategy_snapshot.portfolio_id,
                    strategy_snapshot.portfolio_number,
                    strategy_snapshot.currency,
                    strategy_snapshot.fiscal_year,
                    strategy_snapshot.portfolio_status,
                    strategy_snapshot.capital_capacity_amount,
                    strategy_snapshot.item_count,
                    strategy_snapshot.prioritize_count,
                    strategy_snapshot.hold_count,
                    strategy_snapshot.exit_count,
                    strategy_snapshot.pending_count,
                    strategy_snapshot.prioritized_capacity_amount,
                    strategy_snapshot.remaining_capacity_amount,
                    strategy_snapshot.capacity_utilization_pct,
                    strategy_snapshot.average_priority_score,

                    user_account.full_name
                        AS captured_by_name,

                    strategy_snapshot.captured_at

                FROM procurement_flywheel_strategy_snapshots
                    strategy_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       strategy_snapshot.captured_by_user_id

                """;
    }

    private PortfolioRow mapPortfolio(
            ResultSet resultSet
    ) throws SQLException {
        return new PortfolioRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "portfolio_number"
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "capital_capacity_amount"
                ),
                resultSet.getObject(
                        "portfolio_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "portfolio_owner_name_snapshot"
                ),
                resultSet.getString(
                        "strategic_objective"
                ),
                FlywheelStrategyPortfolioStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "approval_note"
                ),
                resultSet.getString(
                        "approved_by_name"
                ),
                instant(
                        resultSet,
                        "approved_at"
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
                ).toInstant(),
                resultSet.getTimestamp(
                        "updated_at"
                ).toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private ItemRow mapItem(
            ResultSet resultSet
    ) throws SQLException {
        return new ItemRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "portfolio_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "flywheel_lineage_id",
                        UUID.class
                ),
                resultSet.getString(
                        "lineage_number"
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
                resultSet.getInt(
                        "lineage_root_fiscal_year"
                ),
                resultSet.getInt(
                        "lineage_cycle_count"
                ),
                resultSet.getBigDecimal(
                        "lineage_original_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "reference_next_cycle_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "proposed_capacity_amount"
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
                                "step66_recommendation"
                        )
                ),
                resultSet.getBigDecimal(
                        "priority_score"
                ),
                FlywheelStrategyAdvisory.valueOf(
                        resultSet.getString(
                                "advisory_recommendation"
                        )
                ),
                FlywheelStrategyDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),
                resultSet.getString(
                        "decision_note"
                ),
                resultSet.getString(
                        "decided_by_name"
                ),
                instant(
                        resultSet,
                        "decided_at"
                ),
                resultSet.getString(
                        "added_by_name"
                ),
                resultSet.getTimestamp(
                        "added_at"
                ).toInstant()
        );
    }

    private SnapshotRow mapSnapshot(
            ResultSet resultSet
    ) throws SQLException {
        return new SnapshotRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "snapshot_number"
                ),
                resultSet.getObject(
                        "portfolio_id",
                        UUID.class
                ),
                resultSet.getString(
                        "portfolio_number"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                FlywheelStrategyPortfolioStatus.valueOf(
                        resultSet.getString(
                                "portfolio_status"
                        )
                ),
                resultSet.getBigDecimal(
                        "capital_capacity_amount"
                ),
                resultSet.getInt(
                        "item_count"
                ),
                resultSet.getInt(
                        "prioritize_count"
                ),
                resultSet.getInt(
                        "hold_count"
                ),
                resultSet.getInt(
                        "exit_count"
                ),
                resultSet.getInt(
                        "pending_count"
                ),
                resultSet.getBigDecimal(
                        "prioritized_capacity_amount"
                ),
                resultSet.getBigDecimal(
                        "remaining_capacity_amount"
                ),
                resultSet.getBigDecimal(
                        "capacity_utilization_pct"
                ),
                resultSet.getBigDecimal(
                        "average_priority_score"
                ),
                resultSet.getString(
                        "captured_by_name"
                ),
                resultSet.getTimestamp(
                        "captured_at"
                ).toInstant()
        );
    }

    private Instant instant(
            ResultSet resultSet,
            String column
    ) throws SQLException {
        Timestamp value =
                resultSet.getTimestamp(
                        column
                );

        return value == null
                ? null
                : value.toInstant();
    }

    public record PortfolioRow(
            UUID id,
            String portfolioNumber,
            String title,

            String currency,
            int fiscalYear,

            BigDecimal capitalCapacityAmount,

            UUID portfolioOwnerUserId,
            String portfolioOwnerName,

            String strategicObjective,

            FlywheelStrategyPortfolioStatus status,

            String approvalNote,
            String approvedByName,
            Instant approvedAt,

            String closeNote,
            String closedByName,
            Instant closedAt,

            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ItemRow(
            UUID id,
            UUID portfolioId,

            UUID flywheelLineageId,
            String lineageNumber,

            UUID rootTargetValueCaseId,
            String rootTargetValueCaseNumber,
            String rootTargetInitiativeTitle,

            int lineageRootFiscalYear,
            int lineageCycleCount,

            BigDecimal lineageOriginalCapitalAmount,
            BigDecimal referenceNextCycleCapitalAmount,
            BigDecimal proposedCapacityAmount,

            BigDecimal cumulativeProjectedNetValueAmount,
            BigDecimal cumulativeCompoundingValueAmount,
            BigDecimal cumulativeDecayedValueAmount,

            BigDecimal cumulativeValueMultiple,
            BigDecimal latestMarginalValueMultiple,
            BigDecimal latestMarginalNetValueRetentionPct,

            boolean diminishingReturns,

            CapitalFlywheelHealth flywheelHealth,
            CapitalFlywheelRecommendation step66Recommendation,

            BigDecimal priorityScore,
            FlywheelStrategyAdvisory advisoryRecommendation,

            FlywheelStrategyDecision decision,

            String decisionNote,
            String decidedByName,
            Instant decidedAt,

            String addedByName,
            Instant addedAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,

            UUID portfolioId,
            String portfolioNumber,

            String currency,
            int fiscalYear,

            FlywheelStrategyPortfolioStatus portfolioStatus,

            BigDecimal capitalCapacityAmount,

            int itemCount,
            int prioritizeCount,
            int holdCount,
            int exitCount,
            int pendingCount,

            BigDecimal prioritizedCapacityAmount,
            BigDecimal remainingCapacityAmount,
            BigDecimal capacityUtilizationPct,
            BigDecimal averagePriorityScore,

            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID flywheelLineageId,
            String lineageNumber,
            String rootTargetInitiativeTitle,

            BigDecimal proposedCapacityAmount,
            BigDecimal cumulativeProjectedNetValueAmount,

            BigDecimal cumulativeValueMultiple,
            BigDecimal latestMarginalValueMultiple,
            BigDecimal latestMarginalNetValueRetentionPct,

            boolean diminishingReturns,

            CapitalFlywheelHealth flywheelHealth,
            CapitalFlywheelRecommendation step66Recommendation,

            BigDecimal priorityScore,
            FlywheelStrategyAdvisory advisoryRecommendation,

            FlywheelStrategyDecision decision,
            String decisionNote
    ) {
    }
}
