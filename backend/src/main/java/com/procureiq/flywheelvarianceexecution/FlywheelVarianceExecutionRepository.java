package com.procureiq.flywheelvarianceexecution;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;
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
public class FlywheelVarianceExecutionRepository {

    private final JdbcTemplate jdbcTemplate;

    public FlywheelVarianceExecutionRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCaseSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_variance_execution_case_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_variance_execution_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<FlywheelVarianceExecutionUserOptionResponse> users() {
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
                        new FlywheelVarianceExecutionUserOptionResponse(
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

    public boolean hasCaseForVariancePlan(
            UUID variancePlanId
    ) {
        Long count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)

                        FROM procurement_variance_execution_cases

                        WHERE variance_plan_id = ?
                        """,
                        Long.class,
                        variancePlanId
                );

        return count != null
                &&
                count > 0;
    }

    public void lockVariancePlan(
            UUID variancePlanId
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
                        variancePlanId
                );

        if (ids.isEmpty()) {
            throw new com.procureiq.common.exception.ResourceNotFoundException(
                    "Flywheel variance plan not found: "
                            + variancePlanId
            );
        }
    }

    public void lockCase(
            UUID caseId
    ) {
        assertWriteTransaction();

        List<UUID> ids =
                jdbcTemplate.query(
                        """
                        SELECT id

                        FROM procurement_variance_execution_cases

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
                        caseId
                );

        if (ids.isEmpty()) {
            throw new com.procureiq.common.exception.ResourceNotFoundException(
                    "Variance treatment execution case not found: "
                            + caseId
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
                    "Variance execution locking requires an active writable transaction."
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
                        "Variance execution mutations require READ_COMMITTED isolation."
                );
            }

        } catch (
                SQLException exception
        ) {
            throw new IllegalStateException(
                    "Cannot verify variance execution transaction isolation.",
                    exception
            );
        }
    }

    public void createCase(
            UUID id,
            String executionNumber,
            FlywheelVarianceExecutionCaseInput input,
            FlywheelVarianceExecutionSourceResponse source,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_variance_execution_cases (
                    id,
                    execution_number,
                    variance_plan_id,
                    variance_plan_number,
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
                    source_recover_amount,
                    source_write_off_amount,
                    source_investigation_amount,
                    execution_owner_user_id,
                    execution_owner_name_snapshot,
                    execution_objective,
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
                executionNumber,

                source.variancePlanId(),
                source.variancePlanNumber(),

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

                source.sourceVarianceAmount(),
                source.recoverAmount(),
                source.writeOffAmount(),
                source.investigationAmount(),

                input.executionOwnerUserId(),
                ownerName,

                input.executionObjective().trim(),

                currentUserId
        );
    }

    public CaseRow findCase(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE execution_case.id = ?
                        """,
                (
                        rs,
                        rowNumber
                ) ->
                        mapCase(
                                rs
                        ),
                caseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<CaseRow> cases() {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        ORDER BY
                            CASE execution_case.status
                                WHEN 'IN_REVIEW' THEN 1
                                WHEN 'DRAFT' THEN 2
                                WHEN 'VERIFIED' THEN 3
                                ELSE 4
                            END,
                            execution_case.created_at DESC
                        """,
                (
                        rs,
                        rowNumber
                ) ->
                        mapCase(
                                rs
                        )
        );
    }

    public void createItem(
            UUID itemId,
            UUID caseId,
            FlywheelVarianceExecutionCandidateResponse source,
            FlywheelVarianceExecutionValidationResult validation,
            FlywheelVarianceExecutionItemInput input,
            String evidenceReference,
            String evidenceNote,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_variance_execution_items (
                    id,
                    execution_case_id,
                    variance_item_id,
                    settlement_item_id,
                    release_item_id,
                    allocation_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    source_variance_amount,
                    source_decision,
                    executed_amount,
                    outcome,
                    evidence_reference,
                    evidence_date,
                    evidence_note,
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
                    CURRENT_TIMESTAMP
                )
                """,
                itemId,
                caseId,

                source.varianceItemId(),
                source.settlementItemId(),

                source.releaseItemId(),
                source.allocationItemId(),

                source.flywheelLineageId(),
                source.lineageNumber(),

                source.rootTargetInitiativeTitle(),

                validation.sourceVarianceAmount(),

                source.sourceDecision().name(),

                validation.executedAmount(),

                validation.outcome().name(),

                evidenceReference,
                input.evidenceDate(),
                evidenceNote,

                currentUserId
        );
    }

    public List<ItemRow> items(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    execution_item.id,
                    execution_item.execution_case_id,
                    execution_item.variance_item_id,
                    execution_item.settlement_item_id,
                    execution_item.release_item_id,
                    execution_item.allocation_item_id,
                    execution_item.flywheel_lineage_id,
                    execution_item.lineage_number,
                    execution_item.root_target_initiative_title,
                    execution_item.source_variance_amount,
                    execution_item.source_decision,
                    execution_item.executed_amount,
                    execution_item.outcome,
                    execution_item.evidence_reference,
                    execution_item.evidence_date,
                    execution_item.evidence_note,

                    adder.full_name
                        AS added_by_name,

                    execution_item.added_at

                FROM procurement_variance_execution_items
                    execution_item

                JOIN app_users
                    adder
                    ON adder.id =
                       execution_item.added_by_user_id

                WHERE execution_item.execution_case_id = ?

                ORDER BY
                    execution_item.lineage_number
                """,
                (
                        rs,
                        rowNumber
                ) ->
                        mapItem(
                                rs
                        ),
                caseId
        );
    }

    public int submitForReview(
            UUID caseId,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_variance_execution_cases

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
                caseId
        );
    }

    public int verify(
            UUID caseId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_variance_execution_cases

                SET
                    status = 'VERIFIED',
                    verification_note = ?,
                    verified_by_user_id = ?,
                    verified_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'IN_REVIEW'
                """,
                note,
                currentUserId,
                caseId
        );
    }

    public int close(
            UUID caseId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_variance_execution_cases

                SET
                    status = 'CLOSED',
                    close_note = ?,
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'VERIFIED'
                """,
                note,
                currentUserId,
                caseId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            FlywheelVarianceExecutionCaseResponse executionCase,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_variance_execution_snapshots (
                    id,
                    snapshot_number,
                    execution_case_id,
                    execution_number,
                    variance_plan_id,
                    variance_plan_number,
                    case_status,
                    currency,
                    fiscal_year,
                    source_variance_amount,
                    captured_variance_amount,
                    executed_financial_amount,
                    recovered_amount,
                    written_off_amount,
                    completed_investigation_amount,
                    open_exposure_amount,
                    completion_pct,
                    item_count,
                    completed_count,
                    partial_count,
                    unresolved_count,
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
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    FALSE
                )
                """,
                snapshotId,
                snapshotNumber,

                executionCase.id(),
                executionCase.executionNumber(),

                executionCase.variancePlanId(),
                executionCase.variancePlanNumber(),

                executionCase.status().name(),

                executionCase.currency(),
                executionCase.fiscalYear(),

                executionCase.sourceVarianceAmount(),

                executionCase.capturedVarianceAmount(),

                executionCase.executedFinancialAmount(),

                executionCase.recoveredAmount(),
                executionCase.writtenOffAmount(),
                executionCase.completedInvestigationAmount(),

                executionCase.openExposureAmount(),
                executionCase.completionPct(),

                executionCase.itemCount(),
                executionCase.completedCount(),
                executionCase.partialCount(),
                executionCase.unresolvedCount(),

                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            FlywheelVarianceExecutionItemResponse item
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_variance_execution_snapshot_items (
                    id,
                    snapshot_id,
                    variance_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    source_variance_amount,
                    source_decision,
                    executed_amount,
                    outcome,
                    evidence_reference,
                    evidence_date,
                    evidence_note,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,

                item.varianceItemId(),

                item.flywheelLineageId(),
                item.lineageNumber(),

                item.rootTargetInitiativeTitle(),

                item.sourceVarianceAmount(),

                item.sourceDecision().name(),

                item.executedAmount(),

                item.outcome().name(),

                item.evidenceReference(),
                item.evidenceDate(),
                item.evidenceNote()
        );
    }

    public int sealSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_variance_execution_snapshots

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
                        WHERE execution_snapshot.sealed = TRUE
                        AND execution_snapshot.id = ?
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
                        WHERE execution_snapshot.sealed = TRUE

                        ORDER BY
                            execution_snapshot.captured_at DESC

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

    public List<SnapshotRow> snapshotsForCase(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE execution_snapshot.sealed = TRUE
                        AND execution_snapshot.execution_case_id = ?

                        ORDER BY
                            execution_snapshot.captured_at DESC
                        """,
                (
                        rs,
                        rowNumber
                ) ->
                        mapSnapshot(
                                rs
                        ),
                caseId
        );
    }

    public List<SnapshotItemRow> snapshotItems(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    variance_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    source_variance_amount,
                    source_decision,
                    executed_amount,
                    outcome,
                    evidence_reference,
                    evidence_date,
                    evidence_note

                FROM procurement_variance_execution_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY lineage_number
                """,
                (
                        rs,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                rs.getObject(
                                        "variance_item_id",
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
                                                "source_decision"
                                        )
                                ),
                                rs.getBigDecimal(
                                        "executed_amount"
                                ),
                                FlywheelVarianceExecutionOutcome.valueOf(
                                        rs.getString(
                                                "outcome"
                                        )
                                ),
                                rs.getString(
                                        "evidence_reference"
                                ),
                                rs.getObject(
                                        "evidence_date",
                                        LocalDate.class
                                ),
                                rs.getString(
                                        "evidence_note"
                                )
                        ),
                snapshotId
        );
    }

    private String caseSql() {
        return """
                SELECT
                    execution_case.id,
                    execution_case.execution_number,
                    execution_case.variance_plan_id,
                    execution_case.variance_plan_number,
                    execution_case.settlement_case_id,
                    execution_case.reconciliation_number,
                    execution_case.release_batch_id,
                    execution_case.release_number,
                    execution_case.allocation_mandate_id,
                    execution_case.allocation_mandate_number,
                    execution_case.strategy_portfolio_id,
                    execution_case.strategy_portfolio_number,
                    execution_case.title,
                    execution_case.currency,
                    execution_case.fiscal_year,
                    execution_case.source_variance_amount,
                    execution_case.source_recover_amount,
                    execution_case.source_write_off_amount,
                    execution_case.source_investigation_amount,
                    execution_case.execution_owner_user_id,
                    execution_case.execution_owner_name_snapshot,
                    execution_case.execution_objective,
                    execution_case.status,

                    submitter.full_name
                        AS submitted_by_name,

                    execution_case.submitted_at,

                    execution_case.verification_note,

                    verifier.full_name
                        AS verified_by_name,

                    execution_case.verified_at,

                    execution_case.close_note,

                    closer.full_name
                        AS closed_by_name,

                    execution_case.closed_at,

                    execution_case.created_at,
                    execution_case.updated_at,
                    execution_case.version

                FROM procurement_variance_execution_cases
                    execution_case

                LEFT JOIN app_users
                    submitter
                    ON submitter.id =
                       execution_case.submitted_by_user_id

                LEFT JOIN app_users
                    verifier
                    ON verifier.id =
                       execution_case.verified_by_user_id

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       execution_case.closed_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    execution_snapshot.id,
                    execution_snapshot.snapshot_number,
                    execution_snapshot.execution_case_id,
                    execution_snapshot.execution_number,
                    execution_snapshot.variance_plan_id,
                    execution_snapshot.variance_plan_number,
                    execution_snapshot.case_status,
                    execution_snapshot.currency,
                    execution_snapshot.fiscal_year,
                    execution_snapshot.source_variance_amount,
                    execution_snapshot.captured_variance_amount,
                    execution_snapshot.executed_financial_amount,
                    execution_snapshot.recovered_amount,
                    execution_snapshot.written_off_amount,
                    execution_snapshot.completed_investigation_amount,
                    execution_snapshot.open_exposure_amount,
                    execution_snapshot.completion_pct,
                    execution_snapshot.item_count,
                    execution_snapshot.completed_count,
                    execution_snapshot.partial_count,
                    execution_snapshot.unresolved_count,

                    user_account.full_name
                        AS captured_by_name,

                    execution_snapshot.captured_at

                FROM procurement_variance_execution_snapshots
                    execution_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       execution_snapshot.captured_by_user_id

                """;
    }

    private CaseRow mapCase(
            ResultSet rs
    ) throws SQLException {
        return new CaseRow(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "execution_number"
                ),
                rs.getObject(
                        "variance_plan_id",
                        UUID.class
                ),
                rs.getString(
                        "variance_plan_number"
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
                rs.getBigDecimal(
                        "source_recover_amount"
                ),
                rs.getBigDecimal(
                        "source_write_off_amount"
                ),
                rs.getBigDecimal(
                        "source_investigation_amount"
                ),
                rs.getObject(
                        "execution_owner_user_id",
                        UUID.class
                ),
                rs.getString(
                        "execution_owner_name_snapshot"
                ),
                rs.getString(
                        "execution_objective"
                ),
                FlywheelVarianceExecutionCaseStatus.valueOf(
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
                        "verification_note"
                ),
                rs.getString(
                        "verified_by_name"
                ),
                instant(
                        rs,
                        "verified_at"
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

    private ItemRow mapItem(
            ResultSet rs
    ) throws SQLException {
        return new ItemRow(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getObject(
                        "execution_case_id",
                        UUID.class
                ),
                rs.getObject(
                        "variance_item_id",
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
                        "source_variance_amount"
                ),
                FlywheelVarianceDecision.valueOf(
                        rs.getString(
                                "source_decision"
                        )
                ),
                rs.getBigDecimal(
                        "executed_amount"
                ),
                FlywheelVarianceExecutionOutcome.valueOf(
                        rs.getString(
                                "outcome"
                        )
                ),
                rs.getString(
                        "evidence_reference"
                ),
                rs.getObject(
                        "evidence_date",
                        LocalDate.class
                ),
                rs.getString(
                        "evidence_note"
                ),
                rs.getString(
                        "added_by_name"
                ),
                rs.getTimestamp(
                        "added_at"
                ).toInstant()
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
                        "execution_case_id",
                        UUID.class
                ),
                rs.getString(
                        "execution_number"
                ),
                rs.getObject(
                        "variance_plan_id",
                        UUID.class
                ),
                rs.getString(
                        "variance_plan_number"
                ),
                FlywheelVarianceExecutionCaseStatus.valueOf(
                        rs.getString(
                                "case_status"
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
                        "captured_variance_amount"
                ),
                rs.getBigDecimal(
                        "executed_financial_amount"
                ),
                rs.getBigDecimal(
                        "recovered_amount"
                ),
                rs.getBigDecimal(
                        "written_off_amount"
                ),
                rs.getBigDecimal(
                        "completed_investigation_amount"
                ),
                rs.getBigDecimal(
                        "open_exposure_amount"
                ),
                rs.getBigDecimal(
                        "completion_pct"
                ),
                rs.getInt(
                        "item_count"
                ),
                rs.getInt(
                        "completed_count"
                ),
                rs.getInt(
                        "partial_count"
                ),
                rs.getInt(
                        "unresolved_count"
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

    public record CaseRow(
            UUID id,
            String executionNumber,

            UUID variancePlanId,
            String variancePlanNumber,

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

            BigDecimal sourceRecoverAmount,
            BigDecimal sourceWriteOffAmount,
            BigDecimal sourceInvestigationAmount,

            UUID executionOwnerUserId,
            String executionOwnerName,

            String executionObjective,

            FlywheelVarianceExecutionCaseStatus status,

            String submittedByName,
            Instant submittedAt,

            String verificationNote,
            String verifiedByName,
            Instant verifiedAt,

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
            UUID executionCaseId,

            UUID varianceItemId,

            UUID settlementItemId,

            UUID releaseItemId,
            UUID allocationItemId,

            UUID flywheelLineageId,
            String lineageNumber,

            String rootTargetInitiativeTitle,

            BigDecimal sourceVarianceAmount,

            FlywheelVarianceDecision sourceDecision,

            BigDecimal executedAmount,

            FlywheelVarianceExecutionOutcome outcome,

            String evidenceReference,
            LocalDate evidenceDate,
            String evidenceNote,

            String addedByName,
            Instant addedAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,

            UUID executionCaseId,
            String executionNumber,

            UUID variancePlanId,
            String variancePlanNumber,

            FlywheelVarianceExecutionCaseStatus caseStatus,

            String currency,
            int fiscalYear,

            BigDecimal sourceVarianceAmount,

            BigDecimal capturedVarianceAmount,

            BigDecimal executedFinancialAmount,

            BigDecimal recoveredAmount,
            BigDecimal writtenOffAmount,
            BigDecimal completedInvestigationAmount,

            BigDecimal openExposureAmount,
            BigDecimal completionPct,

            int itemCount,
            int completedCount,
            int partialCount,
            int unresolvedCount,

            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID varianceItemId,

            UUID flywheelLineageId,
            String lineageNumber,

            String rootTargetInitiativeTitle,

            BigDecimal sourceVarianceAmount,

            FlywheelVarianceDecision sourceDecision,

            BigDecimal executedAmount,

            FlywheelVarianceExecutionOutcome outcome,

            String evidenceReference,
            LocalDate evidenceDate,
            String evidenceNote
    ) {
    }
}
