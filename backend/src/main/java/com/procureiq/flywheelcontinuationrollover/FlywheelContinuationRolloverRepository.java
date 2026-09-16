package com.procureiq.flywheelcontinuationrollover;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;
import com.procureiq.flywheelcontinuationoutcome.FlywheelContinuationOutcomeResolutionType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class FlywheelContinuationRolloverRepository {

    private final JdbcTemplate jdbc;

    public FlywheelContinuationRolloverRepository(
            JdbcTemplate jdbc
    ) {
        this.jdbc = jdbc;
    }


    private static final String SOURCE_SELECT =
            """
            SELECT
                outcome.id,
                outcome.outcome_number,
                outcome.source_continuation_case_id,
                outcome.source_continuation_number,
                outcome.title,
                outcome.currency,
                outcome.fiscal_year,
                outcome.verified_remaining_residual_amount,

                (
                    SELECT COUNT(*)

                    FROM procurement_remediation_continuation_outcome_items item

                    WHERE item.outcome_case_id =
                        outcome.id

                    AND item.remaining_residual_amount > 0
                ) AS positive_residual_item_count

            FROM procurement_remediation_continuation_outcome_cases outcome

            WHERE outcome.status = 'VERIFIED'

            AND outcome.residual_disposition =
                'FURTHER_GOVERNANCE_REQUIRED'

            AND outcome.verified_remaining_residual_amount > 0
            """;


    private static final String CASE_SELECT =
            """
            SELECT
                rollover.id,
                rollover.rollover_number,
                rollover.source_continuation_outcome_case_id,
                rollover.source_continuation_outcome_number,
                rollover.parent_continuation_case_id,
                rollover.parent_continuation_number,
                rollover.title,
                rollover.currency,
                rollover.fiscal_year,
                rollover.source_remaining_residual_amount,
                rollover.source_residual_item_count,

                (
                    SELECT COUNT(*)

                    FROM procurement_remediation_continuation_rollover_items item

                    WHERE item.rollover_case_id =
                        rollover.id
                ) AS item_count,

                rollover.owner_user_id,
                rollover.owner_name,
                rollover.status,
                rollover.review_submitted_by_user_id,
                rollover.review_submitted_at,
                rollover.approved_by_user_id,
                rollover.approved_at,
                rollover.approval_note,
                rollover.closed_by_user_id,
                rollover.closed_at,
                rollover.close_note,
                rollover.version,
                rollover.created_by_user_id,
                rollover.created_at,
                rollover.updated_at

            FROM procurement_remediation_continuation_rollover_cases rollover
            """;


    public FlywheelContinuationRolloverActor actor(
            UUID id
    ) {
        List<FlywheelContinuationRolloverActor> rows =
                jdbc.query(
                        """
                        SELECT
                            id,
                            full_name,
                            role,
                            active

                        FROM app_users

                        WHERE id = ?
                        """,
                        (
                                rs,
                                row
                        ) ->
                                new FlywheelContinuationRolloverActor(
                                        rs.getObject(
                                                "id",
                                                UUID.class
                                        ),
                                        rs.getString(
                                                "full_name"
                                        ),
                                        rs.getString(
                                                "role"
                                        ),
                                        rs.getBoolean(
                                                "active"
                                        )
                                ),
                        id
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }


    public List<FlywheelContinuationRolloverSourceResponse> eligibleSources() {
        return jdbc.query(
                SOURCE_SELECT
                        + """
                          AND NOT EXISTS (
                              SELECT 1

                              FROM procurement_remediation_continuation_rollover_cases existing

                              WHERE existing.source_continuation_outcome_case_id =
                                  outcome.id
                          )

                          ORDER BY
                              outcome.verified_at DESC,
                              outcome.created_at DESC
                          """,
                this::mapSource
        );
    }


    public FlywheelContinuationRolloverSourceResponse source(
            UUID sourceOutcomeCaseId
    ) {
        List<FlywheelContinuationRolloverSourceResponse> rows =
                jdbc.query(
                        SOURCE_SELECT
                                + """
                                  AND outcome.id = ?
                                  """,
                        this::mapSource,
                        sourceOutcomeCaseId
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }


    public boolean existsForSource(
            UUID sourceOutcomeCaseId
    ) {
        Boolean exists =
                jdbc.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1

                            FROM procurement_remediation_continuation_rollover_cases

                            WHERE source_continuation_outcome_case_id = ?
                        )
                        """,
                        Boolean.class,
                        sourceOutcomeCaseId
                );

        return Boolean.TRUE.equals(
                exists
        );
    }


    public List<FlywheelContinuationRolloverCandidateResponse> candidates(
            UUID sourceOutcomeCaseId
    ) {
        return jdbc.query(
                """
                SELECT
                    item.id,
                    item.source_continuation_item_id,
                    item.source_continuation_action,
                    item.resolution_type,
                    item.remaining_residual_amount

                FROM procurement_remediation_continuation_outcome_items item

                WHERE item.outcome_case_id = ?

                AND item.remaining_residual_amount > 0

                ORDER BY
                    item.created_at,
                    item.id
                """,
                (
                        rs,
                        row
                ) ->
                        new FlywheelContinuationRolloverCandidateResponse(
                                rs.getObject(
                                        "id",
                                        UUID.class
                                ),
                                rs.getObject(
                                        "source_continuation_item_id",
                                        UUID.class
                                ),
                                FlywheelResidualContinuationAction.valueOf(
                                        rs.getString(
                                                "source_continuation_action"
                                        )
                                ),
                                FlywheelContinuationOutcomeResolutionType.valueOf(
                                        rs.getString(
                                                "resolution_type"
                                        )
                                ),
                                rs.getBigDecimal(
                                        "remaining_residual_amount"
                                )
                        ),
                sourceOutcomeCaseId
        );
    }


    public String nextRolloverNumber() {
        Long value =
                jdbc.queryForObject(
                        """
                        SELECT nextval(
                            'procurement_continuation_rollover_number_seq'
                        )
                        """,
                        Long.class
                );

        return "RCR-%08d".formatted(
                value
        );
    }


    public String nextSnapshotNumber() {
        Long value =
                jdbc.queryForObject(
                        """
                        SELECT nextval(
                            'procurement_continuation_rollover_snapshot_seq'
                        )
                        """,
                        Long.class
                );

        return "RCRS-%08d".formatted(
                value
        );
    }


    public int createCase(
            UUID id,
            String rolloverNumber,
            FlywheelContinuationRolloverSourceResponse source,
            FlywheelContinuationRolloverActor actor
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_rollover_cases (
                    id,
                    rollover_number,
                    source_continuation_outcome_case_id,
                    source_continuation_outcome_number,
                    parent_continuation_case_id,
                    parent_continuation_number,
                    title,
                    currency,
                    fiscal_year,
                    source_remaining_residual_amount,
                    source_residual_item_count,
                    owner_user_id,
                    owner_name,
                    status,
                    version,
                    created_by_user_id,
                    created_at,
                    updated_at
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
                    0,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """,
                id,
                rolloverNumber,
                source.continuationOutcomeCaseId(),
                source.continuationOutcomeNumber(),
                source.parentContinuationCaseId(),
                source.parentContinuationNumber(),
                source.title(),
                source.currency(),
                source.fiscalYear(),
                source.remainingResidualAmount(),
                source.positiveResidualItemCount(),
                actor.id(),
                actor.fullName(),
                actor.id()
        );
    }


    public List<FlywheelContinuationRolloverCaseResponse> cases() {
        return jdbc.query(
                CASE_SELECT
                        + """
                          ORDER BY
                              rollover.created_at DESC
                          """,
                this::mapCase
        );
    }


    public FlywheelContinuationRolloverCaseResponse findCase(
            UUID id
    ) {
        List<FlywheelContinuationRolloverCaseResponse> rows =
                jdbc.query(
                        CASE_SELECT
                                + """
                                  WHERE rollover.id = ?
                                  """,
                        this::mapCase,
                        id
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }


    public int createItem(
            UUID id,
            UUID caseId,
            FlywheelContinuationRolloverCandidateResponse source,
            FlywheelResidualContinuationAction continuationAction,
            FlywheelContinuationRolloverItemInput input,
            UUID actorId
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_rollover_items (
                    id,
                    rollover_case_id,
                    source_continuation_outcome_item_id,
                    source_continuation_item_id,
                    source_continuation_action,
                    source_resolution_type,
                    source_remaining_residual_amount,
                    continuation_action,
                    target_date,
                    rationale,
                    created_by_user_id,
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
                id,
                caseId,
                source.continuationOutcomeItemId(),
                source.sourceContinuationItemId(),
                source.sourceContinuationAction().name(),
                source.sourceResolutionType().name(),
                source.remainingResidualAmount(),
                continuationAction.name(),
                input.targetDate(),
                input.rationale().trim(),
                actorId
        );
    }


    public List<FlywheelContinuationRolloverItemResponse> items(
            UUID caseId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    rollover_case_id,
                    source_continuation_outcome_item_id,
                    source_continuation_item_id,
                    source_continuation_action,
                    source_resolution_type,
                    source_remaining_residual_amount,
                    continuation_action,
                    target_date,
                    rationale,
                    created_by_user_id,
                    created_at

                FROM procurement_remediation_continuation_rollover_items

                WHERE rollover_case_id = ?

                ORDER BY
                    created_at,
                    id
                """,
                this::mapItem,
                caseId
        );
    }


    public int submit(
            UUID id,
            UUID actorId
    ) {
        return jdbc.update(
                """
                UPDATE procurement_remediation_continuation_rollover_cases

                SET
                    status = 'IN_REVIEW',
                    review_submitted_by_user_id = ?,
                    review_submitted_at = CURRENT_TIMESTAMP,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?

                AND status = 'DRAFT'
                """,
                actorId,
                id
        );
    }


    public int approve(
            UUID id,
            UUID actorId,
            String note
    ) {
        return jdbc.update(
                """
                UPDATE procurement_remediation_continuation_rollover_cases

                SET
                    status = 'APPROVED',
                    approved_by_user_id = ?,
                    approved_at = CURRENT_TIMESTAMP,
                    approval_note = ?,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?

                AND status = 'IN_REVIEW'
                """,
                actorId,
                note,
                id
        );
    }


    public int close(
            UUID id,
            UUID actorId,
            String note
    ) {
        return jdbc.update(
                """
                UPDATE procurement_remediation_continuation_rollover_cases

                SET
                    status = 'CLOSED',
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    close_note = ?,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?

                AND status = 'APPROVED'
                """,
                actorId,
                note,
                id
        );
    }


    public int createSnapshot(
            UUID id,
            String snapshotNumber,
            FlywheelContinuationRolloverCaseResponse rollover,
            UUID actorId
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_rollover_snapshots (
                    id,
                    snapshot_number,
                    rollover_case_id,
                    rollover_number,
                    source_continuation_outcome_case_id,
                    source_continuation_outcome_number,
                    parent_continuation_case_id,
                    parent_continuation_number,
                    title,
                    currency,
                    fiscal_year,
                    source_remaining_residual_amount,
                    item_count,
                    rollover_status,
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
                    CURRENT_TIMESTAMP,
                    FALSE
                )
                """,
                id,
                snapshotNumber,
                rollover.id(),
                rollover.rolloverNumber(),
                rollover.sourceContinuationOutcomeCaseId(),
                rollover.sourceContinuationOutcomeNumber(),
                rollover.parentContinuationCaseId(),
                rollover.parentContinuationNumber(),
                rollover.title(),
                rollover.currency(),
                rollover.fiscalYear(),
                rollover.sourceRemainingResidualAmount(),
                rollover.itemCount(),
                rollover.status().name(),
                actorId
        );
    }


    public int createSnapshotItem(
            UUID snapshotId,
            FlywheelContinuationRolloverItemResponse item
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_rollover_snapshot_items (
                    id,
                    snapshot_id,
                    rollover_item_id,
                    source_continuation_outcome_item_id,
                    source_continuation_item_id,
                    source_continuation_action,
                    source_resolution_type,
                    source_remaining_residual_amount,
                    continuation_action,
                    target_date,
                    rationale
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
                    ?
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                item.id(),
                item.sourceContinuationOutcomeItemId(),
                item.sourceContinuationItemId(),
                item.sourceContinuationAction().name(),
                item.sourceResolutionType().name(),
                item.sourceRemainingResidualAmount(),
                item.continuationAction().name(),
                item.targetDate(),
                item.rationale()
        );
    }


    public int sealSnapshot(
            UUID id
    ) {
        return jdbc.update(
                """
                UPDATE procurement_remediation_continuation_rollover_snapshots

                SET sealed = TRUE

                WHERE id = ?

                AND sealed = FALSE
                """,
                id
        );
    }


    public List<FlywheelContinuationRolloverSnapshotSummaryResponse> snapshots(
            UUID caseId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    snapshot_number,
                    rollover_case_id,
                    rollover_number,
                    source_continuation_outcome_case_id,
                    source_continuation_outcome_number,
                    parent_continuation_case_id,
                    parent_continuation_number,
                    title,
                    currency,
                    fiscal_year,
                    source_remaining_residual_amount,
                    item_count,
                    rollover_status,
                    captured_by_user_id,
                    captured_at,
                    sealed

                FROM procurement_remediation_continuation_rollover_snapshots

                WHERE rollover_case_id = ?

                ORDER BY
                    captured_at DESC,
                    id DESC
                """,
                this::mapSnapshot,
                caseId
        );
    }


    public FlywheelContinuationRolloverSnapshotSummaryResponse snapshot(
            UUID id
    ) {
        List<FlywheelContinuationRolloverSnapshotSummaryResponse> rows =
                jdbc.query(
                        """
                        SELECT
                            id,
                            snapshot_number,
                            rollover_case_id,
                            rollover_number,
                            source_continuation_outcome_case_id,
                            source_continuation_outcome_number,
                            parent_continuation_case_id,
                            parent_continuation_number,
                            title,
                            currency,
                            fiscal_year,
                            source_remaining_residual_amount,
                            item_count,
                            rollover_status,
                            captured_by_user_id,
                            captured_at,
                            sealed

                        FROM procurement_remediation_continuation_rollover_snapshots

                        WHERE id = ?
                        """,
                        this::mapSnapshot,
                        id
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }


    public List<FlywheelContinuationRolloverSnapshotItemResponse> snapshotItems(
            UUID snapshotId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    snapshot_id,
                    rollover_item_id,
                    source_continuation_outcome_item_id,
                    source_continuation_item_id,
                    source_continuation_action,
                    source_resolution_type,
                    source_remaining_residual_amount,
                    continuation_action,
                    target_date,
                    rationale

                FROM procurement_remediation_continuation_rollover_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY id
                """,
                this::mapSnapshotItem,
                snapshotId
        );
    }


    private FlywheelContinuationRolloverSourceResponse mapSource(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelContinuationRolloverSourceResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "outcome_number"
                ),
                rs.getObject(
                        "source_continuation_case_id",
                        UUID.class
                ),
                rs.getString(
                        "source_continuation_number"
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
                        "verified_remaining_residual_amount"
                ),
                rs.getInt(
                        "positive_residual_item_count"
                )
        );
    }


    private FlywheelContinuationRolloverCaseResponse mapCase(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelContinuationRolloverCaseResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "rollover_number"
                ),
                rs.getObject(
                        "source_continuation_outcome_case_id",
                        UUID.class
                ),
                rs.getString(
                        "source_continuation_outcome_number"
                ),
                rs.getObject(
                        "parent_continuation_case_id",
                        UUID.class
                ),
                rs.getString(
                        "parent_continuation_number"
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
                        "source_remaining_residual_amount"
                ),
                rs.getInt(
                        "source_residual_item_count"
                ),
                rs.getInt(
                        "item_count"
                ),
                rs.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                rs.getString(
                        "owner_name"
                ),
                FlywheelContinuationRolloverStatus.valueOf(
                        rs.getString(
                                "status"
                        )
                ),
                rs.getObject(
                        "review_submitted_by_user_id",
                        UUID.class
                ),
                instant(
                        rs,
                        "review_submitted_at"
                ),
                rs.getObject(
                        "approved_by_user_id",
                        UUID.class
                ),
                instant(
                        rs,
                        "approved_at"
                ),
                rs.getString(
                        "approval_note"
                ),
                rs.getObject(
                        "closed_by_user_id",
                        UUID.class
                ),
                instant(
                        rs,
                        "closed_at"
                ),
                rs.getString(
                        "close_note"
                ),
                rs.getLong(
                        "version"
                ),
                rs.getObject(
                        "created_by_user_id",
                        UUID.class
                ),
                instant(
                        rs,
                        "created_at"
                ),
                instant(
                        rs,
                        "updated_at"
                )
        );
    }


    private FlywheelContinuationRolloverItemResponse mapItem(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelContinuationRolloverItemResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getObject(
                        "rollover_case_id",
                        UUID.class
                ),
                rs.getObject(
                        "source_continuation_outcome_item_id",
                        UUID.class
                ),
                rs.getObject(
                        "source_continuation_item_id",
                        UUID.class
                ),
                FlywheelResidualContinuationAction.valueOf(
                        rs.getString(
                                "source_continuation_action"
                        )
                ),
                FlywheelContinuationOutcomeResolutionType.valueOf(
                        rs.getString(
                                "source_resolution_type"
                        )
                ),
                rs.getBigDecimal(
                        "source_remaining_residual_amount"
                ),
                FlywheelResidualContinuationAction.valueOf(
                        rs.getString(
                                "continuation_action"
                        )
                ),
                rs.getObject(
                        "target_date",
                        LocalDate.class
                ),
                rs.getString(
                        "rationale"
                ),
                rs.getObject(
                        "created_by_user_id",
                        UUID.class
                ),
                instant(
                        rs,
                        "created_at"
                )
        );
    }


    private FlywheelContinuationRolloverSnapshotSummaryResponse mapSnapshot(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelContinuationRolloverSnapshotSummaryResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "snapshot_number"
                ),
                rs.getObject(
                        "rollover_case_id",
                        UUID.class
                ),
                rs.getString(
                        "rollover_number"
                ),
                rs.getObject(
                        "source_continuation_outcome_case_id",
                        UUID.class
                ),
                rs.getString(
                        "source_continuation_outcome_number"
                ),
                rs.getObject(
                        "parent_continuation_case_id",
                        UUID.class
                ),
                rs.getString(
                        "parent_continuation_number"
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
                        "source_remaining_residual_amount"
                ),
                rs.getInt(
                        "item_count"
                ),
                FlywheelContinuationRolloverStatus.valueOf(
                        rs.getString(
                                "rollover_status"
                        )
                ),
                rs.getObject(
                        "captured_by_user_id",
                        UUID.class
                ),
                instant(
                        rs,
                        "captured_at"
                ),
                rs.getBoolean(
                        "sealed"
                )
        );
    }


    private FlywheelContinuationRolloverSnapshotItemResponse mapSnapshotItem(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelContinuationRolloverSnapshotItemResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getObject(
                        "snapshot_id",
                        UUID.class
                ),
                rs.getObject(
                        "rollover_item_id",
                        UUID.class
                ),
                rs.getObject(
                        "source_continuation_outcome_item_id",
                        UUID.class
                ),
                rs.getObject(
                        "source_continuation_item_id",
                        UUID.class
                ),
                FlywheelResidualContinuationAction.valueOf(
                        rs.getString(
                                "source_continuation_action"
                        )
                ),
                FlywheelContinuationOutcomeResolutionType.valueOf(
                        rs.getString(
                                "source_resolution_type"
                        )
                ),
                rs.getBigDecimal(
                        "source_remaining_residual_amount"
                ),
                FlywheelResidualContinuationAction.valueOf(
                        rs.getString(
                                "continuation_action"
                        )
                ),
                rs.getObject(
                        "target_date",
                        LocalDate.class
                ),
                rs.getString(
                        "rationale"
                )
        );
    }


    private Instant instant(
            ResultSet rs,
            String column
    ) throws SQLException {
        var timestamp =
                rs.getTimestamp(
                        column
                );

        return timestamp == null
                ? null
                : timestamp.toInstant();
    }
}
