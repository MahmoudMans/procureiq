package com.procureiq.flywheelcontinuationoutcome;

import com.procureiq.flywheelcontinuation.FlywheelResidualContinuationAction;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class FlywheelContinuationOutcomeRepository {

    private final JdbcTemplate jdbc;

    public FlywheelContinuationOutcomeRepository(
            JdbcTemplate jdbc
    ) {
        this.jdbc = jdbc;
    }

    private static final String SOURCE_SELECT =
            """
            SELECT
                continuation.id,
                continuation.continuation_number,
                continuation.title,
                continuation.currency,
                continuation.fiscal_year,
                continuation.source_remaining_residual_amount,
                continuation.source_residual_item_count

            FROM procurement_remediation_continuation_cases continuation

            WHERE continuation.status = 'CLOSED'
            """;

    private static final String CASE_SELECT =
            """
            SELECT
                outcome.id,
                outcome.outcome_number,
                outcome.source_continuation_case_id,
                outcome.source_continuation_number,
                outcome.title,
                outcome.currency,
                outcome.fiscal_year,
                outcome.source_residual_amount,
                outcome.source_item_count,

                (
                    SELECT COUNT(*)

                    FROM procurement_remediation_continuation_outcome_items item

                    WHERE item.outcome_case_id =
                        outcome.id
                ) AS item_count,

                COALESCE(
                    (
                        SELECT SUM(
                            item.remaining_residual_amount
                        )

                        FROM procurement_remediation_continuation_outcome_items item

                        WHERE item.outcome_case_id =
                            outcome.id
                    ),
                    outcome.source_residual_amount
                ) AS current_remaining_residual_amount,

                outcome.owner_user_id,
                outcome.owner_name,
                outcome.status,
                outcome.residual_disposition,
                outcome.verified_remaining_residual_amount,
                outcome.review_submitted_by_user_id,
                outcome.review_submitted_at,
                outcome.verified_by_user_id,
                outcome.verified_at,
                outcome.verification_note,
                outcome.closed_by_user_id,
                outcome.closed_at,
                outcome.close_note,
                outcome.version,
                outcome.created_by_user_id,
                outcome.created_at,
                outcome.updated_at

            FROM procurement_remediation_continuation_outcome_cases outcome
            """;

    public FlywheelContinuationOutcomeActor actor(
            UUID id
    ) {
        List<FlywheelContinuationOutcomeActor> rows =
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
                                new FlywheelContinuationOutcomeActor(
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

    public List<FlywheelContinuationOutcomeSourceResponse> eligibleSources() {
        return jdbc.query(
                SOURCE_SELECT
                        + """
                          AND NOT EXISTS (
                              SELECT 1

                              FROM procurement_remediation_continuation_outcome_cases existing

                              WHERE existing.source_continuation_case_id =
                                  continuation.id
                          )

                          ORDER BY
                              continuation.closed_at DESC,
                              continuation.created_at DESC
                          """,
                this::mapSource
        );
    }

    public FlywheelContinuationOutcomeSourceResponse source(
            UUID continuationCaseId
    ) {
        List<FlywheelContinuationOutcomeSourceResponse> rows =
                jdbc.query(
                        SOURCE_SELECT
                                + """
                                  AND continuation.id = ?
                                  """,
                        this::mapSource,
                        continuationCaseId
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }

    public boolean existsForSource(
            UUID continuationCaseId
    ) {
        Boolean exists =
                jdbc.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1

                            FROM procurement_remediation_continuation_outcome_cases

                            WHERE source_continuation_case_id = ?
                        )
                        """,
                        Boolean.class,
                        continuationCaseId
                );

        return Boolean.TRUE.equals(
                exists
        );
    }

    public List<FlywheelContinuationOutcomeCandidateResponse> candidates(
            UUID continuationCaseId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    continuation_action,
                    source_remaining_residual_amount

                FROM procurement_remediation_continuation_items

                WHERE continuation_case_id = ?

                ORDER BY
                    created_at,
                    id
                """,
                (
                        rs,
                        row
                ) ->
                        new FlywheelContinuationOutcomeCandidateResponse(
                                rs.getObject(
                                        "id",
                                        UUID.class
                                ),
                                FlywheelResidualContinuationAction.valueOf(
                                        rs.getString(
                                                "continuation_action"
                                        )
                                ),
                                rs.getBigDecimal(
                                        "source_remaining_residual_amount"
                                )
                        ),
                continuationCaseId
        );
    }

    public String nextOutcomeNumber() {
        Long value =
                jdbc.queryForObject(
                        """
                        SELECT nextval(
                            'procurement_continuation_outcome_number_seq'
                        )
                        """,
                        Long.class
                );

        return "RCO-%08d".formatted(
                value
        );
    }

    public String nextSnapshotNumber() {
        Long value =
                jdbc.queryForObject(
                        """
                        SELECT nextval(
                            'procurement_continuation_outcome_snapshot_seq'
                        )
                        """,
                        Long.class
                );

        return "RCOS-%08d".formatted(
                value
        );
    }

    public int createCase(
            UUID id,
            String outcomeNumber,
            FlywheelContinuationOutcomeSourceResponse source,
            FlywheelContinuationOutcomeActor actor
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_outcome_cases (
                    id,
                    outcome_number,
                    source_continuation_case_id,
                    source_continuation_number,
                    title,
                    currency,
                    fiscal_year,
                    source_residual_amount,
                    source_item_count,
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
                outcomeNumber,
                source.continuationCaseId(),
                source.continuationNumber(),
                source.title(),
                source.currency(),
                source.fiscalYear(),
                source.sourceResidualAmount(),
                source.sourceItemCount(),
                actor.id(),
                actor.fullName(),
                actor.id()
        );
    }

    public List<FlywheelContinuationOutcomeCaseResponse> cases() {
        return jdbc.query(
                CASE_SELECT
                        + """
                          ORDER BY
                              outcome.created_at DESC
                          """,
                this::mapCase
        );
    }

    public FlywheelContinuationOutcomeCaseResponse findCase(
            UUID id
    ) {
        List<FlywheelContinuationOutcomeCaseResponse> rows =
                jdbc.query(
                        CASE_SELECT
                                + """
                                  WHERE outcome.id = ?
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
            UUID outcomeCaseId,
            FlywheelContinuationOutcomeCandidateResponse source,
            FlywheelContinuationOutcomeItemInput input,
            BigDecimal remaining,
            UUID actorId
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_outcome_items (
                    id,
                    outcome_case_id,
                    source_continuation_item_id,
                    source_continuation_action,
                    source_residual_amount,
                    resolution_type,
                    observed_reduction_amount,
                    remaining_residual_amount,
                    observed_on,
                    evidence_reference,
                    evidence_note,
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
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                id,
                outcomeCaseId,
                source.continuationItemId(),
                source.continuationAction().name(),
                source.sourceResidualAmount(),
                input.resolutionType().name(),
                input.observedReductionAmount(),
                remaining,
                input.observedOn(),
                input.evidenceReference().trim(),
                input.evidenceNote().trim(),
                actorId
        );
    }

    public List<FlywheelContinuationOutcomeItemResponse> items(
            UUID outcomeCaseId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    outcome_case_id,
                    source_continuation_item_id,
                    source_continuation_action,
                    source_residual_amount,
                    resolution_type,
                    observed_reduction_amount,
                    remaining_residual_amount,
                    observed_on,
                    evidence_reference,
                    evidence_note,
                    created_by_user_id,
                    created_at

                FROM procurement_remediation_continuation_outcome_items

                WHERE outcome_case_id = ?

                ORDER BY
                    created_at,
                    id
                """,
                this::mapItem,
                outcomeCaseId
        );
    }

    public int submit(
            UUID id,
            UUID actorId
    ) {
        return jdbc.update(
                """
                UPDATE procurement_remediation_continuation_outcome_cases

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

    public int verify(
            UUID id,
            UUID actorId,
            String note,
            BigDecimal remaining,
            FlywheelContinuationOutcomeResidualDisposition disposition
    ) {
        return jdbc.update(
                """
                UPDATE procurement_remediation_continuation_outcome_cases

                SET
                    status = 'VERIFIED',
                    verified_by_user_id = ?,
                    verified_at = CURRENT_TIMESTAMP,
                    verification_note = ?,
                    verified_remaining_residual_amount = ?,
                    residual_disposition = ?,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?

                AND status = 'IN_REVIEW'
                """,
                actorId,
                note,
                remaining,
                disposition.name(),
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
                UPDATE procurement_remediation_continuation_outcome_cases

                SET
                    status = 'CLOSED',
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    close_note = ?,
                    version = version + 1,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?

                AND status = 'VERIFIED'
                """,
                actorId,
                note,
                id
        );
    }

    public int createSnapshot(
            UUID id,
            String snapshotNumber,
            FlywheelContinuationOutcomeCaseResponse outcome,
            UUID actorId
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_outcome_snapshots (
                    id,
                    snapshot_number,
                    outcome_case_id,
                    outcome_number,
                    source_continuation_case_id,
                    source_continuation_number,
                    title,
                    currency,
                    fiscal_year,
                    source_residual_amount,
                    remaining_residual_amount,
                    item_count,
                    outcome_status,
                    residual_disposition,
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
                outcome.id(),
                outcome.outcomeNumber(),
                outcome.sourceContinuationCaseId(),
                outcome.sourceContinuationNumber(),
                outcome.title(),
                outcome.currency(),
                outcome.fiscalYear(),
                outcome.sourceResidualAmount(),
                outcome.currentRemainingResidualAmount(),
                outcome.itemCount(),
                outcome.status().name(),
                outcome.residualDisposition() == null
                        ? null
                        : outcome.residualDisposition().name(),
                actorId
        );
    }

    public int createSnapshotItem(
            UUID snapshotId,
            FlywheelContinuationOutcomeItemResponse item
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_continuation_outcome_snapshot_items (
                    id,
                    snapshot_id,
                    outcome_item_id,
                    source_continuation_item_id,
                    source_continuation_action,
                    source_residual_amount,
                    resolution_type,
                    observed_reduction_amount,
                    remaining_residual_amount,
                    observed_on,
                    evidence_reference,
                    evidence_note
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
                    ?
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                item.id(),
                item.sourceContinuationItemId(),
                item.sourceContinuationAction().name(),
                item.sourceResidualAmount(),
                item.resolutionType().name(),
                item.observedReductionAmount(),
                item.remainingResidualAmount(),
                item.observedOn(),
                item.evidenceReference(),
                item.evidenceNote()
        );
    }

    public int sealSnapshot(
            UUID id
    ) {
        return jdbc.update(
                """
                UPDATE procurement_remediation_continuation_outcome_snapshots

                SET sealed = TRUE

                WHERE id = ?

                AND sealed = FALSE
                """,
                id
        );
    }

    public List<FlywheelContinuationOutcomeSnapshotSummaryResponse> snapshots(
            UUID outcomeCaseId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    snapshot_number,
                    outcome_case_id,
                    outcome_number,
                    source_continuation_case_id,
                    source_continuation_number,
                    title,
                    currency,
                    fiscal_year,
                    source_residual_amount,
                    remaining_residual_amount,
                    item_count,
                    outcome_status,
                    residual_disposition,
                    captured_by_user_id,
                    captured_at,
                    sealed

                FROM procurement_remediation_continuation_outcome_snapshots

                WHERE outcome_case_id = ?

                ORDER BY
                    captured_at DESC,
                    id DESC
                """,
                this::mapSnapshot,
                outcomeCaseId
        );
    }

    public FlywheelContinuationOutcomeSnapshotSummaryResponse snapshot(
            UUID id
    ) {
        List<FlywheelContinuationOutcomeSnapshotSummaryResponse> rows =
                jdbc.query(
                        """
                        SELECT
                            id,
                            snapshot_number,
                            outcome_case_id,
                            outcome_number,
                            source_continuation_case_id,
                            source_continuation_number,
                            title,
                            currency,
                            fiscal_year,
                            source_residual_amount,
                            remaining_residual_amount,
                            item_count,
                            outcome_status,
                            residual_disposition,
                            captured_by_user_id,
                            captured_at,
                            sealed

                        FROM procurement_remediation_continuation_outcome_snapshots

                        WHERE id = ?
                        """,
                        this::mapSnapshot,
                        id
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }

    public List<FlywheelContinuationOutcomeSnapshotItemResponse> snapshotItems(
            UUID snapshotId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    snapshot_id,
                    outcome_item_id,
                    source_continuation_item_id,
                    source_continuation_action,
                    source_residual_amount,
                    resolution_type,
                    observed_reduction_amount,
                    remaining_residual_amount,
                    observed_on,
                    evidence_reference,
                    evidence_note

                FROM procurement_remediation_continuation_outcome_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY id
                """,
                this::mapSnapshotItem,
                snapshotId
        );
    }

    private FlywheelContinuationOutcomeSourceResponse mapSource(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelContinuationOutcomeSourceResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "continuation_number"
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
                )
        );
    }

    private FlywheelContinuationOutcomeCaseResponse mapCase(
            ResultSet rs,
            int row
    ) throws SQLException {
        String disposition =
                rs.getString(
                        "residual_disposition"
                );

        return new FlywheelContinuationOutcomeCaseResponse(
                rs.getObject("id", UUID.class),
                rs.getString("outcome_number"),
                rs.getObject(
                        "source_continuation_case_id",
                        UUID.class
                ),
                rs.getString("source_continuation_number"),
                rs.getString("title"),
                rs.getString("currency"),
                rs.getInt("fiscal_year"),
                rs.getBigDecimal("source_residual_amount"),
                rs.getInt("source_item_count"),
                rs.getInt("item_count"),
                rs.getBigDecimal(
                        "current_remaining_residual_amount"
                ),
                rs.getObject("owner_user_id", UUID.class),
                rs.getString("owner_name"),
                FlywheelContinuationOutcomeStatus.valueOf(
                        rs.getString("status")
                ),
                disposition == null
                        ? null
                        : FlywheelContinuationOutcomeResidualDisposition.valueOf(
                                disposition
                        ),
                rs.getBigDecimal(
                        "verified_remaining_residual_amount"
                ),
                rs.getObject(
                        "review_submitted_by_user_id",
                        UUID.class
                ),
                instant(rs, "review_submitted_at"),
                rs.getObject(
                        "verified_by_user_id",
                        UUID.class
                ),
                instant(rs, "verified_at"),
                rs.getString("verification_note"),
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

    private FlywheelContinuationOutcomeItemResponse mapItem(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelContinuationOutcomeItemResponse(
                rs.getObject("id", UUID.class),
                rs.getObject(
                        "outcome_case_id",
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
                rs.getBigDecimal(
                        "source_residual_amount"
                ),
                FlywheelContinuationOutcomeResolutionType.valueOf(
                        rs.getString(
                                "resolution_type"
                        )
                ),
                rs.getBigDecimal(
                        "observed_reduction_amount"
                ),
                rs.getBigDecimal(
                        "remaining_residual_amount"
                ),
                rs.getObject(
                        "observed_on",
                        LocalDate.class
                ),
                rs.getString(
                        "evidence_reference"
                ),
                rs.getString(
                        "evidence_note"
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

    private FlywheelContinuationOutcomeSnapshotSummaryResponse mapSnapshot(
            ResultSet rs,
            int row
    ) throws SQLException {
        String disposition =
                rs.getString(
                        "residual_disposition"
                );

        return new FlywheelContinuationOutcomeSnapshotSummaryResponse(
                rs.getObject("id", UUID.class),
                rs.getString("snapshot_number"),
                rs.getObject(
                        "outcome_case_id",
                        UUID.class
                ),
                rs.getString("outcome_number"),
                rs.getObject(
                        "source_continuation_case_id",
                        UUID.class
                ),
                rs.getString("source_continuation_number"),
                rs.getString("title"),
                rs.getString("currency"),
                rs.getInt("fiscal_year"),
                rs.getBigDecimal("source_residual_amount"),
                rs.getBigDecimal("remaining_residual_amount"),
                rs.getInt("item_count"),
                FlywheelContinuationOutcomeStatus.valueOf(
                        rs.getString("outcome_status")
                ),
                disposition == null
                        ? null
                        : FlywheelContinuationOutcomeResidualDisposition.valueOf(
                                disposition
                        ),
                rs.getObject(
                        "captured_by_user_id",
                        UUID.class
                ),
                instant(rs, "captured_at"),
                rs.getBoolean("sealed")
        );
    }

    private FlywheelContinuationOutcomeSnapshotItemResponse mapSnapshotItem(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelContinuationOutcomeSnapshotItemResponse(
                rs.getObject("id", UUID.class),
                rs.getObject(
                        "snapshot_id",
                        UUID.class
                ),
                rs.getObject(
                        "outcome_item_id",
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
                rs.getBigDecimal(
                        "source_residual_amount"
                ),
                FlywheelContinuationOutcomeResolutionType.valueOf(
                        rs.getString(
                                "resolution_type"
                        )
                ),
                rs.getBigDecimal(
                        "observed_reduction_amount"
                ),
                rs.getBigDecimal(
                        "remaining_residual_amount"
                ),
                rs.getObject(
                        "observed_on",
                        LocalDate.class
                ),
                rs.getString(
                        "evidence_reference"
                ),
                rs.getString(
                        "evidence_note"
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
