package com.procureiq.flywheelrelease;

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
public class FlywheelReleaseRepository {

    private final JdbcTemplate jdbcTemplate;

    public FlywheelReleaseRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextBatchSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_flywheel_release_batch_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_flywheel_release_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<FlywheelReleaseUserOptionResponse> users() {
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
                        new FlywheelReleaseUserOptionResponse(
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

    public boolean hasOpenBatchForMandate(
            UUID mandateId
    ) {
        Long count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)

                        FROM procurement_flywheel_release_batches

                        WHERE allocation_mandate_id = ?
                        AND status <> 'CLOSED'
                        """,
                        Long.class,
                        mandateId
                );

        return count != null
                &&
                count > 0;
    }

    public BigDecimal cumulativeReleasedForMandate(
            UUID mandateId
    ) {
        BigDecimal amount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            SUM(
                                release_item.planned_release_amount
                            ),
                            0
                        )

                        FROM procurement_flywheel_release_items
                            release_item

                        JOIN procurement_flywheel_release_batches
                            release_batch
                            ON release_batch.id =
                               release_item.release_batch_id

                        WHERE release_batch.allocation_mandate_id = ?
                        AND release_item.status = 'RELEASED'
                        """,
                        BigDecimal.class,
                        mandateId
                );

        return amount == null
                ? BigDecimal.ZERO
                : amount;
    }

    public BigDecimal cumulativeReleasedForAllocationItem(
            UUID allocationItemId
    ) {
        BigDecimal amount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            SUM(
                                planned_release_amount
                            ),
                            0
                        )

                        FROM procurement_flywheel_release_items

                        WHERE allocation_item_id = ?
                        AND status = 'RELEASED'
                        """,
                        BigDecimal.class,
                        allocationItemId
                );

        return amount == null
                ? BigDecimal.ZERO
                : amount;
    }

    public void createBatch(
            UUID batchId,
            String releaseNumber,
            FlywheelReleaseBatchInput input,
            FlywheelReleaseMandateAuthorityResponse mandate,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_release_batches (
                    id,
                    release_number,
                    allocation_mandate_id,
                    allocation_mandate_number,
                    strategy_portfolio_id,
                    strategy_portfolio_number,
                    title,
                    currency,
                    fiscal_year,
                    mandate_authorized_amount,
                    release_owner_user_id,
                    release_owner_name_snapshot,
                    release_rationale,
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
                    'DRAFT',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                batchId,
                releaseNumber,

                mandate.allocationMandateId(),
                mandate.allocationMandateNumber(),

                mandate.strategyPortfolioId(),
                mandate.strategyPortfolioNumber(),

                input.title().trim(),

                mandate.currency(),
                mandate.fiscalYear(),

                mandate.authorizedAllocationAmount(),

                input.releaseOwnerUserId(),
                ownerName,

                input.releaseRationale().trim(),

                currentUserId
        );
    }

    public BatchRow findBatch(
            UUID batchId
    ) {
        return jdbcTemplate.query(
                batchSql()
                        + """
                        WHERE release_batch.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapBatch(
                                resultSet
                        ),
                batchId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<BatchRow> batches() {
        return jdbcTemplate.query(
                batchSql()
                        + """
                        ORDER BY
                            CASE release_batch.status
                                WHEN 'IN_EXECUTION' THEN 1
                                WHEN 'DRAFT' THEN 2
                                WHEN 'EXECUTED' THEN 3
                                ELSE 4
                            END,
                            release_batch.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapBatch(
                                resultSet
                        )
        );
    }

    public void createItem(
            UUID itemId,
            UUID batchId,
            FlywheelReleaseCandidateItemResponse candidate,
            BigDecimal plannedReleaseAmount,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_release_items (
                    id,
                    release_batch_id,
                    allocation_item_id,
                    strategy_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    mandate_authorized_item_amount,
                    strategy_priority_score,
                    planned_release_amount,
                    status,
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
                    'PENDING',
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                itemId,
                batchId,

                candidate.allocationItemId(),
                candidate.strategyItemId(),

                candidate.flywheelLineageId(),
                candidate.lineageNumber(),

                candidate.rootTargetInitiativeTitle(),

                candidate.authorizedAllocationAmount(),
                candidate.strategyPriorityScore(),

                plannedReleaseAmount,

                currentUserId
        );
    }

    public ItemRow findItem(
            UUID itemId
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE release_item.id = ?
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
            UUID batchId
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE release_item.release_batch_id = ?

                        ORDER BY
                            release_item.strategy_priority_score DESC,
                            release_item.lineage_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        ),
                batchId
        );
    }

    public int submitForExecution(
            UUID batchId,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_release_batches

                SET
                    status = 'IN_EXECUTION',
                    submitted_by_user_id = ?,
                    submitted_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'DRAFT'
                """,
                currentUserId,
                batchId
        );
    }

    public int releaseItem(
            UUID itemId,
            FlywheelReleaseExecutionInput input,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_release_items

                SET
                    status = 'RELEASED',
                    execution_reference = ?,
                    execution_note = ?,
                    released_by_user_id = ?,
                    released_at = CURRENT_TIMESTAMP

                WHERE id = ?
                AND status = 'PENDING'
                """,
                input.executionReference().trim(),
                input.executionNote().trim(),
                currentUserId,
                itemId
        );
    }

    public int cancelItem(
            UUID itemId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_release_items

                SET
                    status = 'CANCELLED',
                    cancellation_note = ?,
                    cancelled_by_user_id = ?,
                    cancelled_at = CURRENT_TIMESTAMP

                WHERE id = ?
                AND status = 'PENDING'
                """,
                note.trim(),
                currentUserId,
                itemId
        );
    }

    public int markExecuted(
            UUID batchId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_release_batches

                SET
                    status = 'EXECUTED',
                    execution_note = ?,
                    executed_by_user_id = ?,
                    executed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'IN_EXECUTION'
                """,
                note.trim(),
                currentUserId,
                batchId
        );
    }

    public int close(
            UUID batchId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_release_batches

                SET
                    status = 'CLOSED',
                    close_note = ?,
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'EXECUTED'
                """,
                note.trim(),
                currentUserId,
                batchId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            FlywheelReleaseBatchResponse batch,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_release_snapshots (
                    id,
                    snapshot_number,
                    release_batch_id,
                    release_number,
                    allocation_mandate_id,
                    allocation_mandate_number,
                    release_status,
                    currency,
                    fiscal_year,
                    mandate_authorized_amount,
                    batch_planned_release_amount,
                    batch_released_amount,
                    cumulative_mandate_released_amount,
                    remaining_mandate_amount,
                    cumulative_release_utilization_pct,
                    item_count,
                    pending_count,
                    released_count,
                    cancelled_count,
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
                snapshotId,
                snapshotNumber,

                batch.id(),
                batch.releaseNumber(),

                batch.allocationMandateId(),
                batch.allocationMandateNumber(),

                batch.status().name(),

                batch.currency(),
                batch.fiscalYear(),

                batch.mandateAuthorizedAmount(),

                batch.batchPlannedReleaseAmount(),
                batch.batchReleasedAmount(),

                batch.cumulativeMandateReleasedAmount(),
                batch.remainingMandateAmount(),
                batch.cumulativeReleaseUtilizationPct(),

                batch.itemCount(),
                batch.pendingCount(),
                batch.releasedCount(),
                batch.cancelledCount(),

                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            FlywheelReleaseItemResponse item
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_release_snapshot_items (
                    id,
                    snapshot_id,
                    allocation_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    mandate_authorized_item_amount,
                    planned_release_amount,
                    release_item_status,
                    execution_reference,
                    execution_note,
                    cancellation_note,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,

                item.allocationItemId(),

                item.flywheelLineageId(),
                item.lineageNumber(),

                item.rootTargetInitiativeTitle(),

                item.mandateAuthorizedItemAmount(),
                item.plannedReleaseAmount(),

                item.status().name(),

                item.executionReference(),
                item.executionNote(),
                item.cancellationNote()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE release_snapshot.id = ?
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
                            release_snapshot.captured_at DESC

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

    public List<SnapshotRow> snapshotsForBatch(
            UUID batchId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE release_snapshot.release_batch_id = ?

                        ORDER BY
                            release_snapshot.captured_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
                        ),
                batchId
        );
    }

    public List<SnapshotItemRow> snapshotItems(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    allocation_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    mandate_authorized_item_amount,
                    planned_release_amount,
                    release_item_status,
                    execution_reference,
                    execution_note,
                    cancellation_note

                FROM procurement_flywheel_release_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    lineage_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "allocation_item_id",
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
                                        "mandate_authorized_item_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "planned_release_amount"
                                ),
                                FlywheelReleaseItemStatus.valueOf(
                                        resultSet.getString(
                                                "release_item_status"
                                        )
                                ),
                                resultSet.getString(
                                        "execution_reference"
                                ),
                                resultSet.getString(
                                        "execution_note"
                                ),
                                resultSet.getString(
                                        "cancellation_note"
                                )
                        ),
                snapshotId
        );
    }

    private String batchSql() {
        return """
                SELECT
                    release_batch.id,
                    release_batch.release_number,
                    release_batch.allocation_mandate_id,
                    release_batch.allocation_mandate_number,
                    release_batch.strategy_portfolio_id,
                    release_batch.strategy_portfolio_number,
                    release_batch.title,
                    release_batch.currency,
                    release_batch.fiscal_year,
                    release_batch.mandate_authorized_amount,
                    release_batch.release_owner_user_id,
                    release_batch.release_owner_name_snapshot,
                    release_batch.release_rationale,
                    release_batch.status,

                    submitter.full_name
                        AS submitted_by_name,

                    release_batch.submitted_at,

                    release_batch.execution_note,

                    executor.full_name
                        AS executed_by_name,

                    release_batch.executed_at,

                    release_batch.close_note,

                    closer.full_name
                        AS closed_by_name,

                    release_batch.closed_at,

                    release_batch.created_at,
                    release_batch.updated_at,
                    release_batch.version

                FROM procurement_flywheel_release_batches
                    release_batch

                LEFT JOIN app_users
                    submitter
                    ON submitter.id =
                       release_batch.submitted_by_user_id

                LEFT JOIN app_users
                    executor
                    ON executor.id =
                       release_batch.executed_by_user_id

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       release_batch.closed_by_user_id

                """;
    }

    private String itemSql() {
        return """
                SELECT
                    release_item.id,
                    release_item.release_batch_id,
                    release_item.allocation_item_id,
                    release_item.strategy_item_id,
                    release_item.flywheel_lineage_id,
                    release_item.lineage_number,
                    release_item.root_target_initiative_title,
                    release_item.mandate_authorized_item_amount,
                    release_item.strategy_priority_score,
                    release_item.planned_release_amount,
                    release_item.status,
                    release_item.execution_reference,
                    release_item.execution_note,

                    releaser.full_name
                        AS released_by_name,

                    release_item.released_at,

                    release_item.cancellation_note,

                    canceller.full_name
                        AS cancelled_by_name,

                    release_item.cancelled_at,

                    adder.full_name
                        AS added_by_name,

                    release_item.added_at

                FROM procurement_flywheel_release_items
                    release_item

                LEFT JOIN app_users
                    releaser
                    ON releaser.id =
                       release_item.released_by_user_id

                LEFT JOIN app_users
                    canceller
                    ON canceller.id =
                       release_item.cancelled_by_user_id

                JOIN app_users
                    adder
                    ON adder.id =
                       release_item.added_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    release_snapshot.id,
                    release_snapshot.snapshot_number,
                    release_snapshot.release_batch_id,
                    release_snapshot.release_number,
                    release_snapshot.allocation_mandate_id,
                    release_snapshot.allocation_mandate_number,
                    release_snapshot.release_status,
                    release_snapshot.currency,
                    release_snapshot.fiscal_year,
                    release_snapshot.mandate_authorized_amount,
                    release_snapshot.batch_planned_release_amount,
                    release_snapshot.batch_released_amount,
                    release_snapshot.cumulative_mandate_released_amount,
                    release_snapshot.remaining_mandate_amount,
                    release_snapshot.cumulative_release_utilization_pct,
                    release_snapshot.item_count,
                    release_snapshot.pending_count,
                    release_snapshot.released_count,
                    release_snapshot.cancelled_count,

                    user_account.full_name
                        AS captured_by_name,

                    release_snapshot.captured_at

                FROM procurement_flywheel_release_snapshots
                    release_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       release_snapshot.captured_by_user_id

                """;
    }

    private BatchRow mapBatch(
            ResultSet resultSet
    ) throws SQLException {
        return new BatchRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "release_number"
                ),
                resultSet.getObject(
                        "allocation_mandate_id",
                        UUID.class
                ),
                resultSet.getString(
                        "allocation_mandate_number"
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
                        "mandate_authorized_amount"
                ),
                resultSet.getObject(
                        "release_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "release_owner_name_snapshot"
                ),
                resultSet.getString(
                        "release_rationale"
                ),
                FlywheelReleaseBatchStatus.valueOf(
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
                        "execution_note"
                ),
                resultSet.getString(
                        "executed_by_name"
                ),
                instant(
                        resultSet,
                        "executed_at"
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
                        "release_batch_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "allocation_item_id",
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
                        "mandate_authorized_item_amount"
                ),
                resultSet.getBigDecimal(
                        "strategy_priority_score"
                ),
                resultSet.getBigDecimal(
                        "planned_release_amount"
                ),
                FlywheelReleaseItemStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "execution_reference"
                ),
                resultSet.getString(
                        "execution_note"
                ),
                resultSet.getString(
                        "released_by_name"
                ),
                instant(
                        resultSet,
                        "released_at"
                ),
                resultSet.getString(
                        "cancellation_note"
                ),
                resultSet.getString(
                        "cancelled_by_name"
                ),
                instant(
                        resultSet,
                        "cancelled_at"
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
                        "release_batch_id",
                        UUID.class
                ),
                resultSet.getString(
                        "release_number"
                ),
                resultSet.getObject(
                        "allocation_mandate_id",
                        UUID.class
                ),
                resultSet.getString(
                        "allocation_mandate_number"
                ),
                FlywheelReleaseBatchStatus.valueOf(
                        resultSet.getString(
                                "release_status"
                        )
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "mandate_authorized_amount"
                ),
                resultSet.getBigDecimal(
                        "batch_planned_release_amount"
                ),
                resultSet.getBigDecimal(
                        "batch_released_amount"
                ),
                resultSet.getBigDecimal(
                        "cumulative_mandate_released_amount"
                ),
                resultSet.getBigDecimal(
                        "remaining_mandate_amount"
                ),
                resultSet.getBigDecimal(
                        "cumulative_release_utilization_pct"
                ),
                resultSet.getInt(
                        "item_count"
                ),
                resultSet.getInt(
                        "pending_count"
                ),
                resultSet.getInt(
                        "released_count"
                ),
                resultSet.getInt(
                        "cancelled_count"
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

    public record BatchRow(
            UUID id,
            String releaseNumber,

            UUID allocationMandateId,
            String allocationMandateNumber,

            UUID strategyPortfolioId,
            String strategyPortfolioNumber,

            String title,

            String currency,
            int fiscalYear,

            BigDecimal mandateAuthorizedAmount,

            UUID releaseOwnerUserId,
            String releaseOwnerName,

            String releaseRationale,

            FlywheelReleaseBatchStatus status,

            String submittedByName,
            Instant submittedAt,

            String executionNote,
            String executedByName,
            Instant executedAt,

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
            UUID releaseBatchId,

            UUID allocationItemId,
            UUID strategyItemId,

            UUID flywheelLineageId,
            String lineageNumber,

            String rootTargetInitiativeTitle,

            BigDecimal mandateAuthorizedItemAmount,
            BigDecimal strategyPriorityScore,

            BigDecimal plannedReleaseAmount,

            FlywheelReleaseItemStatus status,

            String executionReference,
            String executionNote,

            String releasedByName,
            Instant releasedAt,

            String cancellationNote,
            String cancelledByName,
            Instant cancelledAt,

            String addedByName,
            Instant addedAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,

            UUID releaseBatchId,
            String releaseNumber,

            UUID allocationMandateId,
            String allocationMandateNumber,

            FlywheelReleaseBatchStatus releaseStatus,

            String currency,
            int fiscalYear,

            BigDecimal mandateAuthorizedAmount,

            BigDecimal batchPlannedReleaseAmount,
            BigDecimal batchReleasedAmount,

            BigDecimal cumulativeMandateReleasedAmount,
            BigDecimal remainingMandateAmount,
            BigDecimal cumulativeReleaseUtilizationPct,

            int itemCount,
            int pendingCount,
            int releasedCount,
            int cancelledCount,

            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID allocationItemId,

            UUID flywheelLineageId,
            String lineageNumber,

            String rootTargetInitiativeTitle,

            BigDecimal mandateAuthorizedItemAmount,
            BigDecimal plannedReleaseAmount,

            FlywheelReleaseItemStatus releaseItemStatus,

            String executionReference,
            String executionNote,
            String cancellationNote
    ) {
    }
}
