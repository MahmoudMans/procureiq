package com.procureiq.flywheelallocation;

import com.procureiq.flywheelstrategy.FlywheelStrategyAdvisory;
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
public class FlywheelAllocationRepository {

    private final JdbcTemplate jdbcTemplate;

    public FlywheelAllocationRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextMandateSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_flywheel_allocation_mandate_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_flywheel_allocation_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<FlywheelAllocationUserOptionResponse> users() {
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
                        new FlywheelAllocationUserOptionResponse(
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

    public boolean hasOpenMandateForStrategy(
            UUID strategyPortfolioId
    ) {
        Long count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)

                        FROM procurement_flywheel_allocation_mandates

                        WHERE strategy_portfolio_id = ?
                        AND status <> 'CLOSED'
                        """,
                        Long.class,
                        strategyPortfolioId
                );

        return count != null
                &&
                count > 0;
    }

    public void createMandate(
            UUID mandateId,
            String mandateNumber,
            FlywheelAllocationMandateInput input,
            FlywheelAllocationStrategyResponse strategy,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_allocation_mandates (
                    id,
                    mandate_number,
                    strategy_portfolio_id,
                    strategy_portfolio_number,
                    title,
                    currency,
                    fiscal_year,
                    strategy_capital_capacity_amount,
                    strategy_prioritized_capacity_amount,
                    mandate_owner_user_id,
                    mandate_owner_name_snapshot,
                    mandate_rationale,
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
                    'DRAFT',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                mandateId,
                mandateNumber,

                strategy.strategyPortfolioId(),
                strategy.strategyPortfolioNumber(),

                input.title().trim(),

                strategy.currency(),
                strategy.fiscalYear(),

                strategy.capitalCapacityAmount(),
                strategy.prioritizedCapacityAmount(),

                input.mandateOwnerUserId(),
                ownerName,

                input.mandateRationale().trim(),

                currentUserId
        );
    }

    public MandateRow findMandate(
            UUID mandateId
    ) {
        return jdbcTemplate.query(
                mandateSql()
                        + """
                        WHERE allocation_mandate.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapMandate(
                                resultSet
                        ),
                mandateId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<MandateRow> mandates() {
        return jdbcTemplate.query(
                mandateSql()
                        + """
                        ORDER BY
                            CASE allocation_mandate.status
                                WHEN 'IN_REVIEW' THEN 1
                                WHEN 'DRAFT' THEN 2
                                WHEN 'AUTHORIZED' THEN 3
                                ELSE 4
                            END,
                            allocation_mandate.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapMandate(
                                resultSet
                        )
        );
    }

    public void createItem(
            UUID itemId,
            UUID mandateId,
            FlywheelAllocationCandidateItemResponse strategyItem,
            BigDecimal requestedAllocationAmount,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_allocation_items (
                    id,
                    mandate_id,
                    strategy_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    strategy_proposed_capacity_amount,
                    strategy_priority_score,
                    strategy_advisory_recommendation,
                    requested_allocation_amount,
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
                    CURRENT_TIMESTAMP
                )
                """,
                itemId,
                mandateId,

                strategyItem.strategyItemId(),

                strategyItem.flywheelLineageId(),
                strategyItem.lineageNumber(),

                strategyItem.rootTargetInitiativeTitle(),

                strategyItem.strategyProposedCapacityAmount(),
                strategyItem.strategyPriorityScore(),

                strategyItem
                        .strategyAdvisoryRecommendation()
                        .name(),

                requestedAllocationAmount,

                currentUserId
        );
    }

    public List<ItemRow> items(
            UUID mandateId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    allocation_item.id,
                    allocation_item.mandate_id,
                    allocation_item.strategy_item_id,
                    allocation_item.flywheel_lineage_id,
                    allocation_item.lineage_number,
                    allocation_item.root_target_initiative_title,
                    allocation_item.strategy_proposed_capacity_amount,
                    allocation_item.strategy_priority_score,
                    allocation_item.strategy_advisory_recommendation,
                    allocation_item.requested_allocation_amount,

                    adder.full_name
                        AS added_by_name,

                    allocation_item.added_at

                FROM procurement_flywheel_allocation_items
                    allocation_item

                JOIN app_users
                    adder
                    ON adder.id =
                       allocation_item.added_by_user_id

                WHERE allocation_item.mandate_id = ?

                ORDER BY
                    allocation_item.strategy_priority_score DESC,
                    allocation_item.lineage_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ItemRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "mandate_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "strategy_item_id",
                                        UUID.class
                                ),
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
                                        "strategy_proposed_capacity_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "strategy_priority_score"
                                ),
                                FlywheelStrategyAdvisory.valueOf(
                                        resultSet.getString(
                                                "strategy_advisory_recommendation"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "requested_allocation_amount"
                                ),
                                resultSet.getString(
                                        "added_by_name"
                                ),
                                resultSet.getTimestamp(
                                        "added_at"
                                ).toInstant()
                        ),
                mandateId
        );
    }

    public int submitForReview(
            UUID mandateId,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_allocation_mandates

                SET
                    status = 'IN_REVIEW',
                    submitted_by_user_id = ?,
                    submitted_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'DRAFT'
                """,
                currentUserId,
                mandateId
        );
    }

    public int authorize(
            UUID mandateId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_allocation_mandates

                SET
                    status = 'AUTHORIZED',
                    authorization_note = ?,
                    authorized_by_user_id = ?,
                    authorized_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'IN_REVIEW'
                """,
                note.trim(),
                currentUserId,
                mandateId
        );
    }

    public int close(
            UUID mandateId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_allocation_mandates

                SET
                    status = 'CLOSED',
                    close_note = ?,
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'AUTHORIZED'
                """,
                note.trim(),
                currentUserId,
                mandateId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            FlywheelAllocationMandateResponse mandate,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_allocation_snapshots (
                    id,
                    snapshot_number,
                    mandate_id,
                    mandate_number,
                    strategy_portfolio_id,
                    strategy_portfolio_number,
                    mandate_status,
                    currency,
                    fiscal_year,
                    strategy_prioritized_capacity_amount,
                    requested_allocation_amount,
                    remaining_strategy_capacity_amount,
                    allocation_utilization_pct,
                    item_count,
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

                mandate.id(),
                mandate.mandateNumber(),

                mandate.strategyPortfolioId(),
                mandate.strategyPortfolioNumber(),

                mandate.status().name(),

                mandate.currency(),
                mandate.fiscalYear(),

                mandate.strategyPrioritizedCapacityAmount(),

                mandate.requestedAllocationAmount(),
                mandate.remainingStrategyCapacityAmount(),
                mandate.allocationUtilizationPct(),

                mandate.itemCount(),

                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            FlywheelAllocationItemResponse item
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_allocation_snapshot_items (
                    id,
                    snapshot_id,
                    strategy_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    strategy_proposed_capacity_amount,
                    strategy_priority_score,
                    requested_allocation_amount,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,

                item.strategyItemId(),

                item.flywheelLineageId(),
                item.lineageNumber(),

                item.rootTargetInitiativeTitle(),

                item.strategyProposedCapacityAmount(),
                item.strategyPriorityScore(),

                item.requestedAllocationAmount()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE allocation_snapshot.id = ?
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
                            allocation_snapshot.captured_at DESC

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

    public List<SnapshotRow> snapshotsForMandate(
            UUID mandateId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE allocation_snapshot.mandate_id = ?

                        ORDER BY
                            allocation_snapshot.captured_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        ),
                mandateId
        );
    }

    public List<SnapshotItemRow> snapshotItems(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    strategy_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    strategy_proposed_capacity_amount,
                    strategy_priority_score,
                    requested_allocation_amount

                FROM procurement_flywheel_allocation_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    strategy_priority_score DESC,
                    lineage_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "strategy_item_id",
                                        UUID.class
                                ),
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
                                        "strategy_proposed_capacity_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "strategy_priority_score"
                                ),
                                resultSet.getBigDecimal(
                                        "requested_allocation_amount"
                                )
                        ),
                snapshotId
        );
    }

    private String mandateSql() {
        return """
                SELECT
                    allocation_mandate.id,
                    allocation_mandate.mandate_number,
                    allocation_mandate.strategy_portfolio_id,
                    allocation_mandate.strategy_portfolio_number,
                    allocation_mandate.title,
                    allocation_mandate.currency,
                    allocation_mandate.fiscal_year,
                    allocation_mandate.strategy_capital_capacity_amount,
                    allocation_mandate.strategy_prioritized_capacity_amount,
                    allocation_mandate.mandate_owner_user_id,
                    allocation_mandate.mandate_owner_name_snapshot,
                    allocation_mandate.mandate_rationale,
                    allocation_mandate.status,

                    submitter.full_name
                        AS submitted_by_name,

                    allocation_mandate.submitted_at,

                    allocation_mandate.authorization_note,

                    authorizer.full_name
                        AS authorized_by_name,

                    allocation_mandate.authorized_at,

                    allocation_mandate.close_note,

                    closer.full_name
                        AS closed_by_name,

                    allocation_mandate.closed_at,

                    allocation_mandate.created_at,
                    allocation_mandate.updated_at,
                    allocation_mandate.version

                FROM procurement_flywheel_allocation_mandates
                    allocation_mandate

                LEFT JOIN app_users
                    submitter
                    ON submitter.id =
                       allocation_mandate.submitted_by_user_id

                LEFT JOIN app_users
                    authorizer
                    ON authorizer.id =
                       allocation_mandate.authorized_by_user_id

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       allocation_mandate.closed_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    allocation_snapshot.id,
                    allocation_snapshot.snapshot_number,
                    allocation_snapshot.mandate_id,
                    allocation_snapshot.mandate_number,
                    allocation_snapshot.strategy_portfolio_id,
                    allocation_snapshot.strategy_portfolio_number,
                    allocation_snapshot.mandate_status,
                    allocation_snapshot.currency,
                    allocation_snapshot.fiscal_year,
                    allocation_snapshot.strategy_prioritized_capacity_amount,
                    allocation_snapshot.requested_allocation_amount,
                    allocation_snapshot.remaining_strategy_capacity_amount,
                    allocation_snapshot.allocation_utilization_pct,
                    allocation_snapshot.item_count,

                    user_account.full_name
                        AS captured_by_name,

                    allocation_snapshot.captured_at

                FROM procurement_flywheel_allocation_snapshots
                    allocation_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       allocation_snapshot.captured_by_user_id

                """;
    }

    private MandateRow mapMandate(
            ResultSet resultSet
    ) throws SQLException {
        return new MandateRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "mandate_number"
                ),
                resultSet.getObject(
                        "strategy_portfolio_id",
                        UUID.class
                ),
                resultSet.getString(
                        "strategy_portfolio_number"
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
                        "strategy_capital_capacity_amount"
                ),
                resultSet.getBigDecimal(
                        "strategy_prioritized_capacity_amount"
                ),
                resultSet.getObject(
                        "mandate_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "mandate_owner_name_snapshot"
                ),
                resultSet.getString(
                        "mandate_rationale"
                ),
                FlywheelAllocationMandateStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "submitted_by_name"
                ),
                instant(
                        resultSet,
                        "submitted_at"
                ),
                resultSet.getString(
                        "authorization_note"
                ),
                resultSet.getString(
                        "authorized_by_name"
                ),
                instant(
                        resultSet,
                        "authorized_at"
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
                        "mandate_id",
                        UUID.class
                ),
                resultSet.getString(
                        "mandate_number"
                ),
                resultSet.getObject(
                        "strategy_portfolio_id",
                        UUID.class
                ),
                resultSet.getString(
                        "strategy_portfolio_number"
                ),
                FlywheelAllocationMandateStatus.valueOf(
                        resultSet.getString(
                                "mandate_status"
                        )
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "strategy_prioritized_capacity_amount"
                ),
                resultSet.getBigDecimal(
                        "requested_allocation_amount"
                ),
                resultSet.getBigDecimal(
                        "remaining_strategy_capacity_amount"
                ),
                resultSet.getBigDecimal(
                        "allocation_utilization_pct"
                ),
                resultSet.getInt(
                        "item_count"
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

    public record MandateRow(
            UUID id,
            String mandateNumber,

            UUID strategyPortfolioId,
            String strategyPortfolioNumber,

            String title,

            String currency,
            int fiscalYear,

            BigDecimal strategyCapitalCapacityAmount,
            BigDecimal strategyPrioritizedCapacityAmount,

            UUID mandateOwnerUserId,
            String mandateOwnerName,

            String mandateRationale,

            FlywheelAllocationMandateStatus status,

            String submittedByName,
            Instant submittedAt,

            String authorizationNote,
            String authorizedByName,
            Instant authorizedAt,

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
            UUID mandateId,

            UUID strategyItemId,

            UUID flywheelLineageId,
            String lineageNumber,

            String rootTargetInitiativeTitle,

            BigDecimal strategyProposedCapacityAmount,
            BigDecimal strategyPriorityScore,

            FlywheelStrategyAdvisory strategyAdvisoryRecommendation,

            BigDecimal requestedAllocationAmount,

            String addedByName,
            Instant addedAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,

            UUID mandateId,
            String mandateNumber,

            UUID strategyPortfolioId,
            String strategyPortfolioNumber,

            FlywheelAllocationMandateStatus mandateStatus,

            String currency,
            int fiscalYear,

            BigDecimal strategyPrioritizedCapacityAmount,
            BigDecimal requestedAllocationAmount,
            BigDecimal remainingStrategyCapacityAmount,
            BigDecimal allocationUtilizationPct,

            int itemCount,

            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID strategyItemId,

            UUID flywheelLineageId,
            String lineageNumber,

            String rootTargetInitiativeTitle,

            BigDecimal strategyProposedCapacityAmount,
            BigDecimal strategyPriorityScore,

            BigDecimal requestedAllocationAmount
    ) {
    }
}
