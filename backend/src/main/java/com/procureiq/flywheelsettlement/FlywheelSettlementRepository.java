package com.procureiq.flywheelsettlement;

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
public class FlywheelSettlementRepository {

    private final JdbcTemplate jdbcTemplate;

    public FlywheelSettlementRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCaseSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_flywheel_settlement_case_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_flywheel_settlement_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<FlywheelSettlementUserOptionResponse> users() {
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
                        new FlywheelSettlementUserOptionResponse(
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

    public boolean hasCaseForReleaseBatch(
            UUID releaseBatchId
    ) {
        Long count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)

                        FROM procurement_flywheel_settlement_cases

                        WHERE release_batch_id = ?
                        """,
                        Long.class,
                        releaseBatchId
                );

        return count != null
                &&
                count > 0;
    }

    public void createCase(
            UUID id,
            String number,
            FlywheelSettlementCaseInput input,
            FlywheelSettlementReleaseAuthorityResponse authority,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_settlement_cases (
                    id,
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
                    source_released_amount,
                    reconciliation_owner_user_id,
                    reconciliation_owner_name_snapshot,
                    reconciliation_rationale,
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
                    'DRAFT',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                number,

                authority.releaseBatchId(),
                authority.releaseNumber(),

                authority.allocationMandateId(),
                authority.allocationMandateNumber(),

                authority.strategyPortfolioId(),
                authority.strategyPortfolioNumber(),

                input.title().trim(),

                authority.currency(),
                authority.fiscalYear(),

                authority.releasedAmount(),

                input.reconciliationOwnerUserId(),
                ownerName,

                input.reconciliationRationale().trim(),

                currentUserId
        );
    }

    public CaseRow findCase(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE settlement_case.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
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
                            CASE settlement_case.status
                                WHEN 'IN_REVIEW' THEN 1
                                WHEN 'DRAFT' THEN 2
                                WHEN 'RECONCILED' THEN 3
                                ELSE 4
                            END,
                            settlement_case.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        )
        );
    }

    public void createItem(
            UUID itemId,
            UUID caseId,
            FlywheelSettlementCandidateItemResponse source,
            FlywheelSettlementClassificationResult result,
            FlywheelSettlementItemInput input,
            String evidenceReference,
            String evidenceNote,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_settlement_items (
                    id,
                    settlement_case_id,
                    release_item_id,
                    allocation_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    source_released_amount,
                    settled_amount,
                    reconciliation_status,
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
                    CURRENT_TIMESTAMP
                )
                """,
                itemId,
                caseId,

                source.releaseItemId(),
                source.allocationItemId(),

                source.flywheelLineageId(),
                source.lineageNumber(),

                source.rootTargetInitiativeTitle(),

                result.sourceReleasedAmount(),
                result.settledAmount(),

                result.status().name(),

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
                itemSql()
                        + """
                        WHERE settlement_item.settlement_case_id = ?

                        ORDER BY
                            settlement_item.lineage_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
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
                UPDATE procurement_flywheel_settlement_cases

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

    public int reconcile(
            UUID caseId,
            String note,
            UUID currentUserId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_flywheel_settlement_cases

                SET
                    status = 'RECONCILED',
                    reconciliation_note = ?,
                    reconciled_by_user_id = ?,
                    reconciled_at = CURRENT_TIMESTAMP,
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
                UPDATE procurement_flywheel_settlement_cases

                SET
                    status = 'CLOSED',
                    close_note = ?,
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'RECONCILED'
                """,
                note,
                currentUserId,
                caseId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            FlywheelSettlementCaseResponse settlementCase,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_settlement_snapshots (
                    id,
                    snapshot_number,
                    settlement_case_id,
                    reconciliation_number,
                    release_batch_id,
                    release_number,
                    case_status,
                    currency,
                    fiscal_year,
                    source_released_amount,
                    settled_amount,
                    variance_amount,
                    settlement_pct,
                    item_count,
                    settled_count,
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
                    CURRENT_TIMESTAMP,
                    FALSE
                )
                """,
                snapshotId,
                snapshotNumber,

                settlementCase.id(),
                settlementCase.reconciliationNumber(),

                settlementCase.releaseBatchId(),
                settlementCase.releaseNumber(),

                settlementCase.status().name(),

                settlementCase.currency(),
                settlementCase.fiscalYear(),

                settlementCase.sourceReleasedAmount(),
                settlementCase.settledAmount(),
                settlementCase.varianceAmount(),
                settlementCase.settlementPct(),

                settlementCase.itemCount(),
                settlementCase.settledCount(),
                settlementCase.partialCount(),
                settlementCase.unresolvedCount(),

                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            FlywheelSettlementItemResponse item
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_flywheel_settlement_snapshot_items (
                    id,
                    snapshot_id,
                    release_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    source_released_amount,
                    settled_amount,
                    variance_amount,
                    reconciliation_status,
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

                item.releaseItemId(),

                item.flywheelLineageId(),
                item.lineageNumber(),

                item.rootTargetInitiativeTitle(),

                item.sourceReleasedAmount(),
                item.settledAmount(),
                item.varianceAmount(),

                item.reconciliationStatus().name(),

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
                UPDATE procurement_flywheel_settlement_snapshots

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
                        WHERE settlement_snapshot.id = ?
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
                            settlement_snapshot.captured_at DESC

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

    public List<SnapshotRow> snapshotsForCase(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE settlement_snapshot.settlement_case_id = ?

                        ORDER BY
                            settlement_snapshot.captured_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapSnapshot(
                                resultSet
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
                    release_item_id,
                    flywheel_lineage_id,
                    lineage_number,
                    root_target_initiative_title,
                    source_released_amount,
                    settled_amount,
                    variance_amount,
                    reconciliation_status,
                    evidence_reference,
                    evidence_date,
                    evidence_note

                FROM procurement_flywheel_settlement_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY lineage_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "release_item_id",
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
                                        "source_released_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "settled_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "variance_amount"
                                ),
                                FlywheelSettlementItemStatus.valueOf(
                                        resultSet.getString(
                                                "reconciliation_status"
                                        )
                                ),
                                resultSet.getString(
                                        "evidence_reference"
                                ),
                                resultSet.getObject(
                                        "evidence_date",
                                        LocalDate.class
                                ),
                                resultSet.getString(
                                        "evidence_note"
                                )
                        ),
                snapshotId
        );
    }

    private String caseSql() {
        return """
                SELECT
                    settlement_case.id,
                    settlement_case.reconciliation_number,
                    settlement_case.release_batch_id,
                    settlement_case.release_number,
                    settlement_case.allocation_mandate_id,
                    settlement_case.allocation_mandate_number,
                    settlement_case.strategy_portfolio_id,
                    settlement_case.strategy_portfolio_number,
                    settlement_case.title,
                    settlement_case.currency,
                    settlement_case.fiscal_year,
                    settlement_case.source_released_amount,
                    settlement_case.reconciliation_owner_user_id,
                    settlement_case.reconciliation_owner_name_snapshot,
                    settlement_case.reconciliation_rationale,
                    settlement_case.status,

                    submitter.full_name
                        AS submitted_by_name,

                    settlement_case.submitted_at,
                    settlement_case.reconciliation_note,

                    reconciler.full_name
                        AS reconciled_by_name,

                    settlement_case.reconciled_at,
                    settlement_case.close_note,

                    closer.full_name
                        AS closed_by_name,

                    settlement_case.closed_at,
                    settlement_case.created_at,
                    settlement_case.updated_at,
                    settlement_case.version

                FROM procurement_flywheel_settlement_cases
                    settlement_case

                LEFT JOIN app_users
                    submitter
                    ON submitter.id =
                       settlement_case.submitted_by_user_id

                LEFT JOIN app_users
                    reconciler
                    ON reconciler.id =
                       settlement_case.reconciled_by_user_id

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       settlement_case.closed_by_user_id

                """;
    }

    private String itemSql() {
        return """
                SELECT
                    settlement_item.id,
                    settlement_item.settlement_case_id,
                    settlement_item.release_item_id,
                    settlement_item.allocation_item_id,
                    settlement_item.flywheel_lineage_id,
                    settlement_item.lineage_number,
                    settlement_item.root_target_initiative_title,
                    settlement_item.source_released_amount,
                    settlement_item.settled_amount,
                    settlement_item.variance_amount,
                    settlement_item.reconciliation_status,
                    settlement_item.evidence_reference,
                    settlement_item.evidence_date,
                    settlement_item.evidence_note,

                    adder.full_name
                        AS added_by_name,

                    settlement_item.added_at

                FROM procurement_flywheel_settlement_items
                    settlement_item

                JOIN app_users
                    adder
                    ON adder.id =
                       settlement_item.added_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    settlement_snapshot.id,
                    settlement_snapshot.snapshot_number,
                    settlement_snapshot.settlement_case_id,
                    settlement_snapshot.reconciliation_number,
                    settlement_snapshot.release_batch_id,
                    settlement_snapshot.release_number,
                    settlement_snapshot.case_status,
                    settlement_snapshot.currency,
                    settlement_snapshot.fiscal_year,
                    settlement_snapshot.source_released_amount,
                    settlement_snapshot.settled_amount,
                    settlement_snapshot.variance_amount,
                    settlement_snapshot.settlement_pct,
                    settlement_snapshot.item_count,
                    settlement_snapshot.settled_count,
                    settlement_snapshot.partial_count,
                    settlement_snapshot.unresolved_count,

                    user_account.full_name
                        AS captured_by_name,

                    settlement_snapshot.captured_at

                FROM procurement_flywheel_settlement_snapshots
                    settlement_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       settlement_snapshot.captured_by_user_id

                WHERE settlement_snapshot.sealed = TRUE

                """;
    }

    private CaseRow mapCase(
            ResultSet resultSet
    ) throws SQLException {
        return new CaseRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "reconciliation_number"
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
                        "source_released_amount"
                ),
                resultSet.getObject(
                        "reconciliation_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "reconciliation_owner_name_snapshot"
                ),
                resultSet.getString(
                        "reconciliation_rationale"
                ),
                FlywheelSettlementCaseStatus.valueOf(
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
                        "reconciliation_note"
                ),
                resultSet.getString(
                        "reconciled_by_name"
                ),
                instant(
                        resultSet,
                        "reconciled_at"
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
                        "settlement_case_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "release_item_id",
                        UUID.class
                ),
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
                        "source_released_amount"
                ),
                resultSet.getBigDecimal(
                        "settled_amount"
                ),
                resultSet.getBigDecimal(
                        "variance_amount"
                ),
                FlywheelSettlementItemStatus.valueOf(
                        resultSet.getString(
                                "reconciliation_status"
                        )
                ),
                resultSet.getString(
                        "evidence_reference"
                ),
                resultSet.getObject(
                        "evidence_date",
                        LocalDate.class
                ),
                resultSet.getString(
                        "evidence_note"
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
                        "settlement_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "reconciliation_number"
                ),
                resultSet.getObject(
                        "release_batch_id",
                        UUID.class
                ),
                resultSet.getString(
                        "release_number"
                ),
                FlywheelSettlementCaseStatus.valueOf(
                        resultSet.getString(
                                "case_status"
                        )
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "source_released_amount"
                ),
                resultSet.getBigDecimal(
                        "settled_amount"
                ),
                resultSet.getBigDecimal(
                        "variance_amount"
                ),
                resultSet.getBigDecimal(
                        "settlement_pct"
                ),
                resultSet.getInt(
                        "item_count"
                ),
                resultSet.getInt(
                        "settled_count"
                ),
                resultSet.getInt(
                        "partial_count"
                ),
                resultSet.getInt(
                        "unresolved_count"
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

    public record CaseRow(
            UUID id,
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

            BigDecimal sourceReleasedAmount,

            UUID reconciliationOwnerUserId,
            String reconciliationOwnerName,

            String reconciliationRationale,

            FlywheelSettlementCaseStatus status,

            String submittedByName,
            Instant submittedAt,

            String reconciliationNote,
            String reconciledByName,
            Instant reconciledAt,

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
            UUID settlementCaseId,

            UUID releaseItemId,
            UUID allocationItemId,

            UUID flywheelLineageId,
            String lineageNumber,

            String rootTargetInitiativeTitle,

            BigDecimal sourceReleasedAmount,
            BigDecimal settledAmount,
            BigDecimal varianceAmount,

            FlywheelSettlementItemStatus reconciliationStatus,

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

            UUID settlementCaseId,
            String reconciliationNumber,

            UUID releaseBatchId,
            String releaseNumber,

            FlywheelSettlementCaseStatus caseStatus,

            String currency,
            int fiscalYear,

            BigDecimal sourceReleasedAmount,
            BigDecimal settledAmount,
            BigDecimal varianceAmount,
            BigDecimal settlementPct,

            int itemCount,
            int settledCount,
            int partialCount,
            int unresolvedCount,

            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID releaseItemId,

            UUID flywheelLineageId,
            String lineageNumber,

            String rootTargetInitiativeTitle,

            BigDecimal sourceReleasedAmount,
            BigDecimal settledAmount,
            BigDecimal varianceAmount,

            FlywheelSettlementItemStatus reconciliationStatus,

            String evidenceReference,
            LocalDate evidenceDate,
            String evidenceNote
    ) {
    }
}
