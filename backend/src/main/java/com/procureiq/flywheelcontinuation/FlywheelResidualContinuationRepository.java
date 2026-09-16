package com.procureiq.flywheelcontinuation;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;
import com.procureiq.flywheelremediationoutcome.FlywheelRemediationResolutionType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class FlywheelResidualContinuationRepository {

    private final JdbcTemplate jdbc;

    public FlywheelResidualContinuationRepository(
            JdbcTemplate jdbc
    ) {
        this.jdbc = jdbc;
    }

    private static final String SOURCE_BASE =
            """
            SELECT
                outcome.id,
                outcome.outcome_number,
                outcome.title,
                outcome.currency,
                outcome.fiscal_year,

                SUM(
                    item.remaining_residual_amount
                ) AS remaining_residual_amount,

                COUNT(*) AS residual_item_count

            FROM procurement_remediation_outcome_cases outcome

            JOIN procurement_remediation_outcome_items item
                ON item.outcome_case_id =
                   outcome.id

            WHERE outcome.status = 'VERIFIED'

            AND item.remaining_residual_amount > 0
            """;

    private static final String CASE_SELECT =
            """
            SELECT
                continuation.id,
                continuation.continuation_number,
                continuation.source_outcome_case_id,
                continuation.source_outcome_number,
                continuation.title,
                continuation.currency,
                continuation.fiscal_year,
                continuation.source_remaining_residual_amount,
                continuation.source_residual_item_count,

                (
                    SELECT COUNT(*)

                    FROM procurement_remediation_continuation_items item

                    WHERE item.continuation_case_id =
                        continuation.id
                ) AS item_count,

                continuation.owner_user_id,
                continuation.owner_name,
                continuation.status,
                continuation.review_submitted_by_user_id,
                continuation.review_submitted_at,
                continuation.approved_by_user_id,
                continuation.approved_at,
                continuation.approval_note,
                continuation.closed_by_user_id,
                continuation.closed_at,
                continuation.close_note,
                continuation.version,
                continuation.created_by_user_id,
                continuation.created_at,
                continuation.updated_at

            FROM procurement_remediation_continuation_cases continuation
            """;

    public FlywheelResidualContinuationActor actor(
            UUID id
    ) {
        List<FlywheelResidualContinuationActor> rows =
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
                                new FlywheelResidualContinuationActor(
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

    public List<FlywheelResidualContinuationSourceResponse> eligibleSources() {
        return jdbc.query(
                SOURCE_BASE
                        + """
                          AND NOT EXISTS (
                              SELECT 1

                              FROM procurement_remediation_continuation_cases existing

                              WHERE existing.source_outcome_case_id =
                                  outcome.id
                          )

                          GROUP BY
                              outcome.id

                          HAVING
                              SUM(
                                  item.remaining_residual_amount
                              ) > 0

                          ORDER BY
                              SUM(
                                  item.remaining_residual_amount
                              ) DESC,
                              outcome.created_at DESC
                          """,
                this::mapSource
        );
    }

    public FlywheelResidualContinuationSourceResponse source(
            UUID outcomeCaseId
    ) {
        List<FlywheelResidualContinuationSourceResponse> rows =
                jdbc.query(
                        SOURCE_BASE
                                + """
                                  AND outcome.id = ?

                                  GROUP BY
                                      outcome.id

                                  HAVING
                                      SUM(
                                          item.remaining_residual_amount
                                      ) > 0
                                  """,
                        this::mapSource,
                        outcomeCaseId
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }

    public List<FlywheelResidualContinuationCandidateResponse> candidates(
            UUID outcomeCaseId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    source_action,
                    resolution_type,
                    remaining_residual_amount

                FROM procurement_remediation_outcome_items

                WHERE outcome_case_id = ?

                AND remaining_residual_amount > 0

                ORDER BY
                    remaining_residual_amount DESC,
                    id
                """,
                (
                        rs,
                        row
                ) ->
                        new FlywheelResidualContinuationCandidateResponse(
                                rs.getObject(
                                        "id",
                                        UUID.class
                                ),
                                FlywheelResidualRemediationAction.valueOf(
                                        rs.getString(
                                                "source_action"
                                        )
                                ),
                                FlywheelRemediationResolutionType.valueOf(
                                        rs.getString(
                                                "resolution_type"
                                        )
                                ),
                                rs.getBigDecimal(
                                        "remaining_residual_amount"
                                )
                        ),
                outcomeCaseId
        );
    }

    public boolean existsForSource(
            UUID outcomeCaseId
    ) {
        Boolean value =
                jdbc.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1

                            FROM procurement_remediation_continuation_cases

                            WHERE source_outcome_case_id = ?
                        )
                        """,
                        Boolean.class,
                        outcomeCaseId
                );

        return Boolean.TRUE.equals(
                value
        );
    }

    public String nextContinuationNumber() {
        Long value =
                jdbc.queryForObject(
                        """
                        SELECT nextval(
                            'procurement_remediation_continuation_number_seq'
                        )
                        """,
                        Long.class
                );

        return "RCC-%08d".formatted(
                value
        );
    }

    public String nextSnapshotNumber() {
        Long value =
                jdbc.queryForObject(
                        """
                        SELECT nextval(
                            'procurement_remediation_continuation_snapshot_number_seq'
                        )
                        """,
                        Long.class
                );

        return "RCS-%08d".formatted(
                value
        );
    }

    public int createCase(
            UUID id,
            String continuationNumber,
            FlywheelResidualContinuationSourceResponse source,
            String title,
            FlywheelResidualContinuationActor actor
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_cases (
                    id,
                    continuation_number,
                    source_outcome_case_id,
                    source_outcome_number,
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
                    'DRAFT',
                    0,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """,
                id,
                continuationNumber,
                source.outcomeCaseId(),
                source.outcomeNumber(),
                title,
                source.currency(),
                source.fiscalYear(),
                source.remainingResidualAmount(),
                source.residualItemCount(),
                actor.id(),
                actor.fullName(),
                actor.id()
        );
    }

    public List<FlywheelResidualContinuationCaseResponse> cases() {
        return jdbc.query(
                CASE_SELECT
                        + """
                          ORDER BY
                              continuation.created_at DESC
                          """,
                this::mapCase
        );
    }

    public FlywheelResidualContinuationCaseResponse findCase(
            UUID id
    ) {
        List<FlywheelResidualContinuationCaseResponse> rows =
                jdbc.query(
                        CASE_SELECT
                                + """
                                  WHERE continuation.id = ?
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
            UUID continuationCaseId,
            FlywheelResidualContinuationCandidateResponse source,
            FlywheelResidualContinuationItemInput input,
            UUID actorId
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_items (
                    id,
                    continuation_case_id,
                    source_outcome_item_id,
                    source_action,
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
                    CURRENT_TIMESTAMP
                )
                """,
                id,
                continuationCaseId,
                source.outcomeItemId(),
                source.sourceAction().name(),
                source.sourceResolutionType().name(),
                source.remainingResidualAmount(),
                input.continuationAction().name(),
                input.targetDate(),
                input.rationale().trim(),
                actorId
        );
    }

    public List<FlywheelResidualContinuationItemResponse> items(
            UUID continuationCaseId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    continuation_case_id,
                    source_outcome_item_id,
                    source_action,
                    source_resolution_type,
                    source_remaining_residual_amount,
                    continuation_action,
                    target_date,
                    rationale,
                    created_by_user_id,
                    created_at

                FROM procurement_remediation_continuation_items

                WHERE continuation_case_id = ?

                ORDER BY
                    created_at,
                    id
                """,
                this::mapItem,
                continuationCaseId
        );
    }

    public int submit(
            UUID id,
            UUID actorId
    ) {
        return jdbc.update(
                """
                UPDATE procurement_remediation_continuation_cases

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
                UPDATE procurement_remediation_continuation_cases

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
                UPDATE procurement_remediation_continuation_cases

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
            FlywheelResidualContinuationCaseResponse continuation,
            UUID actorId
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_snapshots (
                    id,
                    snapshot_number,
                    continuation_case_id,
                    continuation_number,
                    source_outcome_case_id,
                    source_outcome_number,
                    title,
                    currency,
                    fiscal_year,
                    source_remaining_residual_amount,
                    item_count,
                    continuation_status,
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
                    CURRENT_TIMESTAMP,
                    FALSE
                )
                """,
                id,
                snapshotNumber,
                continuation.id(),
                continuation.continuationNumber(),
                continuation.sourceOutcomeCaseId(),
                continuation.sourceOutcomeNumber(),
                continuation.title(),
                continuation.currency(),
                continuation.fiscalYear(),
                continuation.sourceRemainingResidualAmount(),
                continuation.itemCount(),
                continuation.status().name(),
                actorId
        );
    }

    public int createSnapshotItem(
            UUID snapshotId,
            FlywheelResidualContinuationItemResponse item
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_snapshot_items (
                    id,
                    snapshot_id,
                    continuation_item_id,
                    source_outcome_item_id,
                    source_action,
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
                    ?
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                item.id(),
                item.sourceOutcomeItemId(),
                item.sourceAction().name(),
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
                UPDATE procurement_remediation_continuation_snapshots

                SET sealed = TRUE

                WHERE id = ?
                AND sealed = FALSE
                """,
                id
        );
    }

    public List<FlywheelResidualContinuationSnapshotSummaryResponse> snapshots(
            UUID continuationCaseId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    snapshot_number,
                    continuation_case_id,
                    continuation_number,
                    source_outcome_case_id,
                    source_outcome_number,
                    title,
                    currency,
                    fiscal_year,
                    source_remaining_residual_amount,
                    item_count,
                    continuation_status,
                    captured_by_user_id,
                    captured_at,
                    sealed

                FROM procurement_remediation_continuation_snapshots

                WHERE continuation_case_id = ?

                ORDER BY
                    captured_at DESC,
                    id DESC
                """,
                this::mapSnapshot,
                continuationCaseId
        );
    }

    public FlywheelResidualContinuationSnapshotSummaryResponse snapshot(
            UUID id
    ) {
        List<FlywheelResidualContinuationSnapshotSummaryResponse> rows =
                jdbc.query(
                        """
                        SELECT
                            id,
                            snapshot_number,
                            continuation_case_id,
                            continuation_number,
                            source_outcome_case_id,
                            source_outcome_number,
                            title,
                            currency,
                            fiscal_year,
                            source_remaining_residual_amount,
                            item_count,
                            continuation_status,
                            captured_by_user_id,
                            captured_at,
                            sealed

                        FROM procurement_remediation_continuation_snapshots

                        WHERE id = ?
                        """,
                        this::mapSnapshot,
                        id
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }

    public List<FlywheelResidualContinuationSnapshotItemResponse> snapshotItems(
            UUID snapshotId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    snapshot_id,
                    continuation_item_id,
                    source_outcome_item_id,
                    source_action,
                    source_resolution_type,
                    source_remaining_residual_amount,
                    continuation_action,
                    target_date,
                    rationale

                FROM procurement_remediation_continuation_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY id
                """,
                this::mapSnapshotItem,
                snapshotId
        );
    }

    private FlywheelResidualContinuationSourceResponse mapSource(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelResidualContinuationSourceResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "outcome_number"
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
                        "remaining_residual_amount"
                ),
                rs.getInt(
                        "residual_item_count"
                )
        );
    }

    private FlywheelResidualContinuationCaseResponse mapCase(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelResidualContinuationCaseResponse(
                rs.getObject("id", UUID.class),
                rs.getString("continuation_number"),
                rs.getObject("source_outcome_case_id", UUID.class),
                rs.getString("source_outcome_number"),
                rs.getString("title"),
                rs.getString("currency"),
                rs.getInt("fiscal_year"),
                rs.getBigDecimal("source_remaining_residual_amount"),
                rs.getInt("source_residual_item_count"),
                rs.getInt("item_count"),
                rs.getObject("owner_user_id", UUID.class),
                rs.getString("owner_name"),
                FlywheelResidualContinuationStatus.valueOf(
                        rs.getString("status")
                ),
                rs.getObject(
                        "review_submitted_by_user_id",
                        UUID.class
                ),
                instant(rs, "review_submitted_at"),
                rs.getObject(
                        "approved_by_user_id",
                        UUID.class
                ),
                instant(rs, "approved_at"),
                rs.getString("approval_note"),
                rs.getObject(
                        "closed_by_user_id",
                        UUID.class
                ),
                instant(rs, "closed_at"),
                rs.getString("close_note"),
                rs.getLong("version"),
                rs.getObject(
                        "created_by_user_id",
                        UUID.class
                ),
                instant(rs, "created_at"),
                instant(rs, "updated_at")
        );
    }

    private FlywheelResidualContinuationItemResponse mapItem(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelResidualContinuationItemResponse(
                rs.getObject("id", UUID.class),
                rs.getObject(
                        "continuation_case_id",
                        UUID.class
                ),
                rs.getObject(
                        "source_outcome_item_id",
                        UUID.class
                ),
                FlywheelResidualRemediationAction.valueOf(
                        rs.getString("source_action")
                ),
                FlywheelRemediationResolutionType.valueOf(
                        rs.getString("source_resolution_type")
                ),
                rs.getBigDecimal(
                        "source_remaining_residual_amount"
                ),
                FlywheelResidualContinuationAction.valueOf(
                        rs.getString("continuation_action")
                ),
                rs.getObject(
                        "target_date",
                        LocalDate.class
                ),
                rs.getString("rationale"),
                rs.getObject(
                        "created_by_user_id",
                        UUID.class
                ),
                instant(rs, "created_at")
        );
    }

    private FlywheelResidualContinuationSnapshotSummaryResponse mapSnapshot(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelResidualContinuationSnapshotSummaryResponse(
                rs.getObject("id", UUID.class),
                rs.getString("snapshot_number"),
                rs.getObject(
                        "continuation_case_id",
                        UUID.class
                ),
                rs.getString("continuation_number"),
                rs.getObject(
                        "source_outcome_case_id",
                        UUID.class
                ),
                rs.getString("source_outcome_number"),
                rs.getString("title"),
                rs.getString("currency"),
                rs.getInt("fiscal_year"),
                rs.getBigDecimal(
                        "source_remaining_residual_amount"
                ),
                rs.getInt("item_count"),
                FlywheelResidualContinuationStatus.valueOf(
                        rs.getString("continuation_status")
                ),
                rs.getObject(
                        "captured_by_user_id",
                        UUID.class
                ),
                instant(rs, "captured_at"),
                rs.getBoolean("sealed")
        );
    }

    private FlywheelResidualContinuationSnapshotItemResponse mapSnapshotItem(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelResidualContinuationSnapshotItemResponse(
                rs.getObject("id", UUID.class),
                rs.getObject("snapshot_id", UUID.class),
                rs.getObject(
                        "continuation_item_id",
                        UUID.class
                ),
                rs.getObject(
                        "source_outcome_item_id",
                        UUID.class
                ),
                FlywheelResidualRemediationAction.valueOf(
                        rs.getString("source_action")
                ),
                FlywheelRemediationResolutionType.valueOf(
                        rs.getString("source_resolution_type")
                ),
                rs.getBigDecimal(
                        "source_remaining_residual_amount"
                ),
                FlywheelResidualContinuationAction.valueOf(
                        rs.getString("continuation_action")
                ),
                rs.getObject(
                        "target_date",
                        LocalDate.class
                ),
                rs.getString("rationale")
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
