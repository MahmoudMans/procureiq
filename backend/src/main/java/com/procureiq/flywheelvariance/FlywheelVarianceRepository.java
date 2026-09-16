package com.procureiq.flywheelvariance;

import com.procureiq.flywheelsettlement.FlywheelSettlementItemStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class FlywheelVarianceRepository {

    private final JdbcTemplate jdbcTemplate;

    public FlywheelVarianceRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextPlanSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_flywheel_variance_plan_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_flywheel_variance_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<FlywheelVarianceUserOptionResponse> users() {
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
                        rs,
                        rowNumber
                ) ->
                        new FlywheelVarianceUserOptionResponse(
                                rs.getObject(
                                        "id",
                                        UUID.class
                                ),
                                rs.getString(
                                        "full_name"
                                ),
                                rs.getString(
                                        "role"
                                )
                        )
        );
    }

    public boolean hasPlanForSettlementCase(
            UUID settlementCaseId
    ) {
        Long count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)

                        FROM procurement_flywheel_variance_plans

                        WHERE settlement_case_id = ?
                        """,
                        Long.class,
                        settlementCaseId
                );

        return count != null
                &&
                count > 0;
    }

    public void lockSettlementCase(
            UUID settlementCaseId
    ) {
        assertWriteTransaction();

        List<UUID> ids =
                jdbcTemplate.query(
                        """
                        SELECT id

                        FROM procurement_flywheel_settlement_cases

                        WHERE id = ?

                        FOR UPDATE
                        """,
                        (
                                rs,
                                rowNumber
                        ) ->
                                rs.getObject(
                                        "id",
                                        UUID.class
                                ),
                        settlementCaseId
                );

        if (
                ids.isEmpty()
        ) {
            throw new com.procureiq.common.exception.ResourceNotFoundException(
                    "Flywheel settlement reconciliation case not found: "
                            + settlementCaseId
            );
        }
    }

    public void lockPlan(
            UUID planId
    ) {
        assertWriteTransaction();

        List<UUID> ids =
                jdbcTemplate.query(
                        """
                        SELECT id

                        FROM procurement_flywheel_variance_plans

                        WHERE id = ?

                        FOR UPDATE
                        """,
                        (
                                rs,
                                rowNumber
                        ) ->
                                rs.getObject(
                                        "id",
                                        UUID.class
                                ),
                        planId
                );

        if (
                ids.isEmpty()
        ) {
            throw new com.procureiq.common.exception.ResourceNotFoundException(
                    "Flywheel variance plan not found: "
                            + planId
            );
        }
    }

    private void assertWriteTransaction() {
        if (
                !org.springframework.transaction.support.TransactionSynchronizationManager
                        .isActualTransactionActive()
                ||
                org.springframework.transaction.support.TransactionSynchronizationManager
                        .isCurrentTransactionReadOnly()
        ) {
            throw new IllegalStateException(
                    "Variance governance locking requires an active writable transaction."
            );
        }

        try {
            java.sql.Connection connection =
                    org.springframework.jdbc.datasource.DataSourceUtils
                            .getConnection(
                                    java.util.Objects.requireNonNull(
                                            jdbcTemplate.getDataSource()
                                    )
                            );

            if (
                    connection.getTransactionIsolation()
                            != java.sql.Connection.TRANSACTION_READ_COMMITTED
            ) {
                throw new IllegalStateException(
                        "Variance governance mutations require READ_COMMITTED isolation."
                );
            }

        } catch (
                SQLException exception
        ) {
            throw new IllegalStateException(
                    "Cannot verify variance governance transaction isolation.",
                    exception
            );
        }
    }

    public void createPlan(
            UUID id,
            String planNumber,
            FlywheelVariancePlanInput input,
            FlywheelVarianceSourceResponse source,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_variance_plans (
                    id,
                    plan_number,
                    settlement_case_id,
                    reconciliation_number,
                    release_batch_id,
                    release_number,
                    allocation_mandate_id,
                    allocation_mandate_number,
                    strategy_portfolio_id,
                    strategy_portfolio_number,
                    title,
                    currency,
                    fiscal_year,
                    source_variance_amount,
                    plan_owner_user_id,
                    plan_owner_name_snapshot,
                    resolution_objective,
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
                    'DRAFT',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                planNumber,

                source.settlementCaseId(),
                source.reconciliationNumber(),

                source.releaseBatchId(),
                source.releaseNumber(),

                source.allocationMandateId(),
                source.allocationMandateNumber(),

                source.strategyPortfolioId(),
                source.strategyPortfolioNumber(),

                input.title().trim(),

                source.currency(),
                source.fiscalYear(),

                source.varianceAmount(),

                input.planOwnerUserId(),
                ownerName,

                input.resolutionObjective().trim(),

                currentUserId
        );
    }

    public PlanRow findPlan(
            UUID planId
    ) {
        return jdbcTemplate.query(
                planSql()
                        + """
                        WHERE variance_plan.id = ?
                        """,
                (
                        rs,
                        rowNumber
                ) ->
                        mapPlan(
                                rs
                        ),
                planId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<PlanRow> plans() {
        return jdbcTemplate.query(
                planSql()
                        + """
                        ORDER BY
                            CASE variance_plan.status
                                WHEN 'IN_REVIEW' THEN 1
                                WHEN 'DRAFT' THEN 2
                                WHEN 'APPROVED' THEN 3
                                ELSE 4
                            END,
                            variance_plan.created_at DESC
                        """,
                (
                        rs,
                        rowNumber
                ) ->
                        mapPlan(
                                rs
                        )
        );
    }

    public void createItem(
            UUID itemId,
            UUID planId,
            FlywheelVarianceCandidateResponse source,
            FlywheelVarianceItemInput input,
            String rationale,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_variance_items (
                    id,
                    variance_plan_id,
                    settlement_item_id,
                    release_item_id,
                    allocation_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    source_released_amount,
                    source_settled_amount,
                    source_variance_amount,
                    source_reconciliation_status,
                    decision,
                    decision_rationale,
                    target_date,
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
                    CURRENT_TIMESTAMP
                )
                """,
                itemId,
                planId,

                source.settlementItemId(),

                source.releaseItemId(),
                source.allocationItemId(),

                source.flywheelLineageId(),
                source.lineageNumber(),

                source.rootTargetInitiativeTitle(),

                source.sourceReleasedAmount(),
                source.sourceSettledAmount(),
                source.sourceVarianceAmount(),

                source.sourceReconciliationStatus().name(),

                input.decision().name(),

                rationale,

                input.targetDate(),

                currentUserId
        );
    }

    public List<ItemRow> items(
            UUID planId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    variance_item.id,
                    variance_item.variance_plan_id,
                    variance_item.settlement_item_id,
                    variance_item.release_item_id,
                    variance_item.allocation_item_id,
                    variance_item.flywheel_lineage_id,
                    variance_item.lineage_number,
                    variance_item.root_target_initiative_title,
                    variance_item.source_released_amount,
                    variance_item.source_settled_amount,
                    variance_item.source_variance_amount,
                    variance_item.source_reconciliation_status,
                    variance_item.decision,
                    variance_item.decision_rationale,
                    variance_item.target_date,

                    adder.full_name
                        AS added_by_name,

                    variance_item.added_at

                FROM procurement_flywheel_variance_items
                    variance_item

                JOIN app_users
                    adder
                    ON adder.id =
                       variance_item.added_by_user_id

                WHERE variance_item.variance_plan_id = ?

                ORDER BY
                    variance_item.target_date,
                    variance_item.lineage_number
                """,
                (
                        rs,
                        rowNumber
                ) ->
                        new ItemRow(
                                rs.getObject(
                                        "id",
                                        UUID.class
                                ),
                                rs.getObject(
                                        "variance_plan_id",
                                        UUID.class
                                ),
                                rs.getObject(
                                        "settlement_item_id",
                                        UUID.class
                                ),
                                rs.getObject(
                                        "release_item_id",
                                        UUID.class
                                ),
                                rs.getObject(
                                        "allocation_item_id",
                                        UUID.class
                                ),
                                rs.getObject(
                                        "flywheel_lineage_id",
                                        UUID.class
                                ),
                                rs.getString(
                                        "lineage_number"
                                ),
                                rs.getString(
                                        "root_target_initiative_title"
                                ),
                                rs.getBigDecimal(
                                        "source_released_amount"
                                ),
                                rs.getBigDecimal(
                                        "source_settled_amount"
                                ),
                                rs.getBigDecimal(
                                        "source_variance_amount"
                                ),
                                FlywheelSettlementItemStatus.valueOf(
                                        rs.getString(
                                                "source_reconciliation_status"
                                        )
                                ),
                                FlywheelVarianceDecision.valueOf(
                                        rs.getString(
                                                "decision"
                                        )
                                ),
                                rs.getString(
                                        "decision_rationale"
                                ),
                                rs.getObject(
                                        "target_date",
                                        LocalDate.class
                                ),
                                rs.getString(
                                        "added_by_name"
                                ),
                                rs.getTimestamp(
                                        "added_at"
                                ).toInstant()
                        ),
                planId
        );
    }

    public int submitForReview(
            UUID planId,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_variance_plans

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
                planId
        );
    }

    public int approve(
            UUID planId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_variance_plans

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
                note,
                currentUserId,
                planId
        );
    }

    public int close(
            UUID planId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_variance_plans

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
                note,
                currentUserId,
                planId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            FlywheelVariancePlanResponse plan,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_variance_snapshots (
                    id,
                    snapshot_number,
                    variance_plan_id,
                    plan_number,
                    settlement_case_id,
                    reconciliation_number,
                    plan_status,
                    currency,
                    fiscal_year,
                    source_variance_amount,
                    governed_amount,
                    recover_amount,
                    write_off_amount,
                    investigation_amount,
                    coverage_pct,
                    item_count,
                    recover_count,
                    write_off_count,
                    investigation_count,
                    captured_by_user_id,
                    captured_at,
                    sealed
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
                    CURRENT_TIMESTAMP,
                    FALSE
                )
                """,
                snapshotId,
                snapshotNumber,

                plan.id(),
                plan.planNumber(),

                plan.settlementCaseId(),
                plan.reconciliationNumber(),

                plan.status().name(),

                plan.currency(),
                plan.fiscalYear(),

                plan.sourceVarianceAmount(),

                plan.governedAmount(),
                plan.recoverAmount(),
                plan.writeOffAmount(),
                plan.investigationAmount(),
                plan.coveragePct(),

                plan.itemCount(),
                plan.recoverCount(),
                plan.writeOffCount(),
                plan.investigationCount(),

                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            FlywheelVarianceItemResponse item
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_variance_snapshot_items (
                    id,
                    snapshot_id,
                    settlement_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    source_variance_amount,
                    decision,
                    decision_rationale,
                    target_date,
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

                item.settlementItemId(),

                item.flywheelLineageId(),
                item.lineageNumber(),

                item.rootTargetInitiativeTitle(),

                item.sourceVarianceAmount(),

                item.decision().name(),

                item.decisionRationale(),

                item.targetDate()
        );
    }

    public int sealSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_variance_snapshots

                SET sealed = TRUE

                WHERE id = ?
                AND sealed = FALSE
                """,
                snapshotId
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE variance_snapshot.sealed = TRUE
                        AND variance_snapshot.id = ?
                        """,
                (
                        rs,
                        rowNumber
                ) ->
                        mapSnapshot(
                                rs
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
                        WHERE variance_snapshot.sealed = TRUE

                        ORDER BY
                            variance_snapshot.captured_at DESC

                        LIMIT 100
                        """,
                (
                        rs,
                        rowNumber
                ) ->
                        mapSnapshot(
                                rs
                        )
        );
    }

    public List<SnapshotRow> snapshotsForPlan(
            UUID planId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE variance_snapshot.sealed = TRUE
                        AND variance_snapshot.variance_plan_id = ?

                        ORDER BY
                            variance_snapshot.captured_at DESC
                        """,
                (
                        rs,
                        rowNumber
                ) ->
                        mapSnapshot(
                                rs
                        ),
                planId
        );
    }

    public List<SnapshotItemRow> snapshotItems(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    settlement_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    source_variance_amount,
                    decision,
                    decision_rationale,
                    target_date

                FROM procurement_flywheel_variance_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    target_date,
                    lineage_number
                """,
                (
                        rs,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                rs.getObject(
                                        "settlement_item_id",
                                        UUID.class
                                ),
                                rs.getObject(
                                        "flywheel_lineage_id",
                                        UUID.class
                                ),
                                rs.getString(
                                        "lineage_number"
                                ),
                                rs.getString(
                                        "root_target_initiative_title"
                                ),
                                rs.getBigDecimal(
                                        "source_variance_amount"
                                ),
                                FlywheelVarianceDecision.valueOf(
                                        rs.getString(
                                                "decision"
                                        )
                                ),
                                rs.getString(
                                        "decision_rationale"
                                ),
                                rs.getObject(
                                        "target_date",
                                        LocalDate.class
                                )
                        ),
                snapshotId
        );
    }

    private String planSql() {
        return """
                SELECT
                    variance_plan.id,
                    variance_plan.plan_number,
                    variance_plan.settlement_case_id,
                    variance_plan.reconciliation_number,
                    variance_plan.release_batch_id,
                    variance_plan.release_number,
                    variance_plan.allocation_mandate_id,
                    variance_plan.allocation_mandate_number,
                    variance_plan.strategy_portfolio_id,
                    variance_plan.strategy_portfolio_number,
                    variance_plan.title,
                    variance_plan.currency,
                    variance_plan.fiscal_year,
                    variance_plan.source_variance_amount,
                    variance_plan.plan_owner_user_id,
                    variance_plan.plan_owner_name_snapshot,
                    variance_plan.resolution_objective,
                    variance_plan.status,

                    submitter.full_name
                        AS submitted_by_name,

                    variance_plan.submitted_at,

                    variance_plan.approval_note,

                    approver.full_name
                        AS approved_by_name,

                    variance_plan.approved_at,

                    variance_plan.close_note,

                    closer.full_name
                        AS closed_by_name,

                    variance_plan.closed_at,

                    variance_plan.created_at,
                    variance_plan.updated_at,
                    variance_plan.version

                FROM procurement_flywheel_variance_plans
                    variance_plan

                LEFT JOIN app_users
                    submitter
                    ON submitter.id =
                       variance_plan.submitted_by_user_id

                LEFT JOIN app_users
                    approver
                    ON approver.id =
                       variance_plan.approved_by_user_id

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       variance_plan.closed_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    variance_snapshot.id,
                    variance_snapshot.snapshot_number,
                    variance_snapshot.variance_plan_id,
                    variance_snapshot.plan_number,
                    variance_snapshot.settlement_case_id,
                    variance_snapshot.reconciliation_number,
                    variance_snapshot.plan_status,
                    variance_snapshot.currency,
                    variance_snapshot.fiscal_year,
                    variance_snapshot.source_variance_amount,
                    variance_snapshot.governed_amount,
                    variance_snapshot.recover_amount,
                    variance_snapshot.write_off_amount,
                    variance_snapshot.investigation_amount,
                    variance_snapshot.coverage_pct,
                    variance_snapshot.item_count,
                    variance_snapshot.recover_count,
                    variance_snapshot.write_off_count,
                    variance_snapshot.investigation_count,

                    user_account.full_name
                        AS captured_by_name,

                    variance_snapshot.captured_at

                FROM procurement_flywheel_variance_snapshots
                    variance_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       variance_snapshot.captured_by_user_id

                """;
    }

    private PlanRow mapPlan(
            ResultSet rs
    ) throws SQLException {
        return new PlanRow(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "plan_number"
                ),
                rs.getObject(
                        "settlement_case_id",
                        UUID.class
                ),
                rs.getString(
                        "reconciliation_number"
                ),
                rs.getObject(
                        "release_batch_id",
                        UUID.class
                ),
                rs.getString(
                        "release_number"
                ),
                rs.getObject(
                        "allocation_mandate_id",
                        UUID.class
                ),
                rs.getString(
                        "allocation_mandate_number"
                ),
                rs.getObject(
                        "strategy_portfolio_id",
                        UUID.class
                ),
                rs.getString(
                        "strategy_portfolio_number"
                ),
                rs.getString(
                        "title"
                ),
                rs.getString(
                        "currency"
                ),
                rs.getInt(
                        "fiscal_year"
                ),
                rs.getBigDecimal(
                        "source_variance_amount"
                ),
                rs.getObject(
                        "plan_owner_user_id",
                        UUID.class
                ),
                rs.getString(
                        "plan_owner_name_snapshot"
                ),
                rs.getString(
                        "resolution_objective"
                ),
                FlywheelVariancePlanStatus.valueOf(
                        rs.getString(
                                "status"
                        )
                ),
                rs.getString(
                        "submitted_by_name"
                ),
                instant(
                        rs,
                        "submitted_at"
                ),
                rs.getString(
                        "approval_note"
                ),
                rs.getString(
                        "approved_by_name"
                ),
                instant(
                        rs,
                        "approved_at"
                ),
                rs.getString(
                        "close_note"
                ),
                rs.getString(
                        "closed_by_name"
                ),
                instant(
                        rs,
                        "closed_at"
                ),
                rs.getTimestamp(
                        "created_at"
                ).toInstant(),
                rs.getTimestamp(
                        "updated_at"
                ).toInstant(),
                rs.getLong(
                        "version"
                )
        );
    }

    private SnapshotRow mapSnapshot(
            ResultSet rs
    ) throws SQLException {
        return new SnapshotRow(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "snapshot_number"
                ),
                rs.getObject(
                        "variance_plan_id",
                        UUID.class
                ),
                rs.getString(
                        "plan_number"
                ),
                rs.getObject(
                        "settlement_case_id",
                        UUID.class
                ),
                rs.getString(
                        "reconciliation_number"
                ),
                FlywheelVariancePlanStatus.valueOf(
                        rs.getString(
                                "plan_status"
                        )
                ),
                rs.getString(
                        "currency"
                ),
                rs.getInt(
                        "fiscal_year"
                ),
                rs.getBigDecimal(
                        "source_variance_amount"
                ),
                rs.getBigDecimal(
                        "governed_amount"
                ),
                rs.getBigDecimal(
                        "recover_amount"
                ),
                rs.getBigDecimal(
                        "write_off_amount"
                ),
                rs.getBigDecimal(
                        "investigation_amount"
                ),
                rs.getBigDecimal(
                        "coverage_pct"
                ),
                rs.getInt(
                        "item_count"
                ),
                rs.getInt(
                        "recover_count"
                ),
                rs.getInt(
                        "write_off_count"
                ),
                rs.getInt(
                        "investigation_count"
                ),
                rs.getString(
                        "captured_by_name"
                ),
                rs.getTimestamp(
                        "captured_at"
                ).toInstant()
        );
    }

    private Instant instant(
            ResultSet rs,
            String column
    ) throws SQLException {
        Timestamp value =
                rs.getTimestamp(
                        column
                );

        return value == null
                ? null
                : value.toInstant();
    }

    public record PlanRow(
            UUID id,
            String planNumber,

            UUID settlementCaseId,
            String reconciliationNumber,

            UUID releaseBatchId,
            String releaseNumber,

            UUID allocationMandateId,
            String allocationMandateNumber,

            UUID strategyPortfolioId,
            String strategyPortfolioNumber,

            String title,

            String currency,
            int fiscalYear,

            BigDecimal sourceVarianceAmount,

            UUID planOwnerUserId,
            String planOwnerName,

            String resolutionObjective,

            FlywheelVariancePlanStatus status,

            String submittedByName,
            Instant submittedAt,

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
            UUID variancePlanId,

            UUID settlementItemId,

            UUID releaseItemId,
            UUID allocationItemId,

            UUID flywheelLineageId,
            String lineageNumber,

            String rootTargetInitiativeTitle,

            BigDecimal sourceReleasedAmount,
            BigDecimal sourceSettledAmount,
            BigDecimal sourceVarianceAmount,

            FlywheelSettlementItemStatus sourceReconciliationStatus,

            FlywheelVarianceDecision decision,

            String decisionRationale,

            LocalDate targetDate,

            String addedByName,
            Instant addedAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,

            UUID variancePlanId,
            String planNumber,

            UUID settlementCaseId,
            String reconciliationNumber,

            FlywheelVariancePlanStatus planStatus,

            String currency,
            int fiscalYear,

            BigDecimal sourceVarianceAmount,

            BigDecimal governedAmount,
            BigDecimal recoverAmount,
            BigDecimal writeOffAmount,
            BigDecimal investigationAmount,
            BigDecimal coveragePct,

            int itemCount,
            int recoverCount,
            int writeOffCount,
            int investigationCount,

            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID settlementItemId,

            UUID flywheelLineageId,
            String lineageNumber,

            String rootTargetInitiativeTitle,

            BigDecimal sourceVarianceAmount,

            FlywheelVarianceDecision decision,

            String decisionRationale,

            LocalDate targetDate
    ) {
    }
}
