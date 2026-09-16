package com.procureiq.flywheelremediationoutcome;

import com.procureiq.flywheelremediation.FlywheelResidualRemediationAction;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class FlywheelRemediationOutcomeRepository {

    private final JdbcTemplate jdbc;

    public FlywheelRemediationOutcomeRepository(
            JdbcTemplate jdbc
    ) {
        this.jdbc = jdbc;
    }

    private static final String SOURCE_SELECT =
            """
            SELECT
                plan.id,
                plan.title,
                plan.currency,
                plan.fiscal_year,
                plan.source_residual_amount,

                (
                    SELECT COUNT(*)
                    FROM procurement_residual_remediation_items item
                    WHERE item.remediation_plan_id = plan.id
                ) AS item_count

            FROM procurement_residual_remediation_plans plan

            WHERE plan.status IN (
                'APPROVED',
                'CLOSED'
            )

            AND plan.source_residual_amount > 0
            """;

    private static final String CASE_SELECT =
            """
            SELECT
                outcome.id,
                outcome.outcome_number,
                outcome.source_remediation_plan_id,
                outcome.title,
                outcome.currency,
                outcome.fiscal_year,
                outcome.source_residual_amount,
                outcome.source_item_count,

                COALESCE(
                    metrics.resolved_amount,
                    0
                ) AS resolved_amount,

                COALESCE(
                    metrics.remaining_residual_amount,
                    outcome.source_residual_amount
                ) AS remaining_residual_amount,

                COALESCE(
                    metrics.item_count,
                    0
                ) AS item_count,

                COALESCE(
                    metrics.unresolved_item_count,
                    outcome.source_item_count
                ) AS unresolved_item_count,

                outcome.owner_user_id,
                outcome.owner_name,
                outcome.status,
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

            FROM procurement_remediation_outcome_cases outcome

            LEFT JOIN (
                SELECT
                    outcome_case_id,

                    SUM(
                        resolved_amount
                    ) AS resolved_amount,

                    SUM(
                        remaining_residual_amount
                    ) AS remaining_residual_amount,

                    COUNT(*) AS item_count,

                    COUNT(*)
                    FILTER (
                        WHERE remaining_residual_amount > 0
                    ) AS unresolved_item_count

                FROM procurement_remediation_outcome_items

                GROUP BY
                    outcome_case_id
            ) metrics
                ON metrics.outcome_case_id =
                   outcome.id
            """;

    public FlywheelRemediationOutcomeActor actor(
            UUID id
    ) {
        List<FlywheelRemediationOutcomeActor> rows =
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
                                new FlywheelRemediationOutcomeActor(
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

    public List<FlywheelRemediationOutcomeSourceResponse> eligibleSources() {
        return jdbc.query(
                SOURCE_SELECT
                        + """
                          AND NOT EXISTS (
                              SELECT 1

                              FROM procurement_remediation_outcome_cases existing

                              WHERE existing.source_remediation_plan_id =
                                  plan.id
                          )

                          ORDER BY
                              plan.source_residual_amount DESC,
                              plan.created_at DESC
                          """,
                this::mapSource
        );
    }

    public FlywheelRemediationOutcomeSourceResponse findSource(
            UUID remediationPlanId
    ) {
        List<FlywheelRemediationOutcomeSourceResponse> rows =
                jdbc.query(
                        SOURCE_SELECT
                                + """
                                  AND plan.id = ?
                                  """,
                        this::mapSource,
                        remediationPlanId
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }

    public List<FlywheelRemediationOutcomeCandidateResponse> candidates(
            UUID remediationPlanId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    remediation_action,
                    residual_amount

                FROM procurement_residual_remediation_items

                WHERE remediation_plan_id = ?

                ORDER BY
                    residual_amount DESC,
                    id
                """,
                (
                        rs,
                        row
                ) ->
                        new FlywheelRemediationOutcomeCandidateResponse(
                                rs.getObject(
                                        "id",
                                        UUID.class
                                ),
                                FlywheelResidualRemediationAction.valueOf(
                                        rs.getString(
                                                "remediation_action"
                                        )
                                ),
                                rs.getBigDecimal(
                                        "residual_amount"
                                )
                        ),
                remediationPlanId
        );
    }

    public boolean hasCaseForSource(
            UUID remediationPlanId
    ) {
        Boolean value =
                jdbc.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1

                            FROM procurement_remediation_outcome_cases

                            WHERE source_remediation_plan_id = ?
                        )
                        """,
                        Boolean.class,
                        remediationPlanId
                );

        return Boolean.TRUE.equals(
                value
        );
    }

    public String nextOutcomeNumber() {
        Long value =
                jdbc.queryForObject(
                        """
                        SELECT nextval(
                            'procurement_remediation_outcome_number_seq'
                        )
                        """,
                        Long.class
                );

        return "ROC-%08d".formatted(
                value
        );
    }

    public String nextSnapshotNumber() {
        Long value =
                jdbc.queryForObject(
                        """
                        SELECT nextval(
                            'procurement_remediation_outcome_snapshot_number_seq'
                        )
                        """,
                        Long.class
                );

        return "ROS-%08d".formatted(
                value
        );
    }

    public int createCase(
            UUID id,
            String outcomeNumber,
            FlywheelRemediationOutcomeSourceResponse source,
            String title,
            FlywheelRemediationOutcomeActor actor
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_outcome_cases (
                    id,
                    outcome_number,
                    source_remediation_plan_id,
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
                    'DRAFT',
                    0,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """,
                id,
                outcomeNumber,
                source.remediationPlanId(),
                title,
                source.currency(),
                source.fiscalYear(),
                source.residualAmount(),
                source.itemCount(),
                actor.id(),
                actor.fullName(),
                actor.id()
        );
    }

    public List<FlywheelRemediationOutcomeCaseResponse> cases() {
        return jdbc.query(
                CASE_SELECT
                        + """
                          ORDER BY
                              outcome.created_at DESC
                          """,
                this::mapCase
        );
    }

    public FlywheelRemediationOutcomeCaseResponse findCase(
            UUID id
    ) {
        List<FlywheelRemediationOutcomeCaseResponse> rows =
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
            FlywheelRemediationOutcomeCandidateResponse source,
            FlywheelRemediationOutcomeItemInput input,
            UUID actorId
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_outcome_items (
                    id,
                    outcome_case_id,
                    source_remediation_item_id,
                    source_action,
                    source_residual_amount,
                    resolution_type,
                    resolved_amount,
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
                source.remediationItemId(),
                source.sourceAction().name(),
                source.sourceResidualAmount(),
                input.resolutionType().name(),
                input.resolvedAmount(),
                source.sourceResidualAmount()
                        .subtract(
                                input.resolvedAmount()
                        ),
                input.observedOn(),
                input.evidenceReference().trim(),
                input.evidenceNote().trim(),
                actorId
        );
    }

    public List<FlywheelRemediationOutcomeItemResponse> items(
            UUID outcomeCaseId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    outcome_case_id,
                    source_remediation_item_id,
                    source_action,
                    source_residual_amount,
                    resolution_type,
                    resolved_amount,
                    remaining_residual_amount,
                    observed_on,
                    evidence_reference,
                    evidence_note,
                    created_by_user_id,
                    created_at

                FROM procurement_remediation_outcome_items

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
                UPDATE procurement_remediation_outcome_cases

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
            String note
    ) {
        return jdbc.update(
                """
                UPDATE procurement_remediation_outcome_cases

                SET
                    status = 'VERIFIED',
                    verified_by_user_id = ?,
                    verified_at = CURRENT_TIMESTAMP,
                    verification_note = ?,
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
                UPDATE procurement_remediation_outcome_cases

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
            FlywheelRemediationOutcomeCaseResponse outcome,
            UUID actorId
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_outcome_snapshots (
                    id,
                    snapshot_number,
                    outcome_case_id,
                    outcome_number,
                    title,
                    currency,
                    fiscal_year,
                    source_residual_amount,
                    resolved_amount,
                    remaining_residual_amount,
                    item_count,
                    unresolved_item_count,
                    outcome_status,
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
                    CURRENT_TIMESTAMP,
                    FALSE
                )
                """,
                id,
                snapshotNumber,
                outcome.id(),
                outcome.outcomeNumber(),
                outcome.title(),
                outcome.currency(),
                outcome.fiscalYear(),
                outcome.sourceResidualAmount(),
                outcome.resolvedAmount(),
                outcome.remainingResidualAmount(),
                outcome.itemCount(),
                outcome.unresolvedItemCount(),
                outcome.status().name(),
                actorId
        );
    }

    public int createSnapshotItem(
            UUID snapshotId,
            FlywheelRemediationOutcomeItemResponse item
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_remediation_outcome_snapshot_items (
                    id,
                    snapshot_id,
                    outcome_item_id,
                    source_remediation_item_id,
                    source_action,
                    source_residual_amount,
                    resolution_type,
                    resolved_amount,
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
                item.sourceRemediationItemId(),
                item.sourceAction().name(),
                item.sourceResidualAmount(),
                item.resolutionType().name(),
                item.resolvedAmount(),
                item.remainingResidualAmount(),
                item.observedOn(),
                item.evidenceReference(),
                item.evidenceNote()
        );
    }

    public int sealSnapshot(
            UUID snapshotId
    ) {
        return jdbc.update(
                """
                UPDATE procurement_remediation_outcome_snapshots

                SET sealed = TRUE

                WHERE id = ?
                AND sealed = FALSE
                """,
                snapshotId
        );
    }

    public List<FlywheelRemediationOutcomeSnapshotSummaryResponse> snapshots(
            UUID outcomeCaseId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    snapshot_number,
                    outcome_case_id,
                    outcome_number,
                    title,
                    currency,
                    fiscal_year,
                    source_residual_amount,
                    resolved_amount,
                    remaining_residual_amount,
                    item_count,
                    unresolved_item_count,
                    outcome_status,
                    captured_by_user_id,
                    captured_at,
                    sealed

                FROM procurement_remediation_outcome_snapshots

                WHERE outcome_case_id = ?

                ORDER BY
                    captured_at DESC,
                    id DESC
                """,
                this::mapSnapshot,
                outcomeCaseId
        );
    }

    public FlywheelRemediationOutcomeSnapshotSummaryResponse findSnapshot(
            UUID id
    ) {
        List<FlywheelRemediationOutcomeSnapshotSummaryResponse> rows =
                jdbc.query(
                        """
                        SELECT
                            id,
                            snapshot_number,
                            outcome_case_id,
                            outcome_number,
                            title,
                            currency,
                            fiscal_year,
                            source_residual_amount,
                            resolved_amount,
                            remaining_residual_amount,
                            item_count,
                            unresolved_item_count,
                            outcome_status,
                            captured_by_user_id,
                            captured_at,
                            sealed

                        FROM procurement_remediation_outcome_snapshots

                        WHERE id = ?
                        """,
                        this::mapSnapshot,
                        id
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }

    public List<FlywheelRemediationOutcomeSnapshotItemResponse> snapshotItems(
            UUID snapshotId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    snapshot_id,
                    outcome_item_id,
                    source_remediation_item_id,
                    source_action,
                    source_residual_amount,
                    resolution_type,
                    resolved_amount,
                    remaining_residual_amount,
                    observed_on,
                    evidence_reference,
                    evidence_note

                FROM procurement_remediation_outcome_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY id
                """,
                this::mapSnapshotItem,
                snapshotId
        );
    }

    private FlywheelRemediationOutcomeSourceResponse mapSource(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelRemediationOutcomeSourceResponse(
                rs.getObject(
                        "id",
                        UUID.class
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
                        "source_residual_amount"
                ),
                rs.getInt(
                        "item_count"
                )
        );
    }

    private FlywheelRemediationOutcomeCaseResponse mapCase(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelRemediationOutcomeCaseResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "outcome_number"
                ),
                rs.getObject(
                        "source_remediation_plan_id",
                        UUID.class
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
                        "source_residual_amount"
                ),
                rs.getInt(
                        "source_item_count"
                ),
                rs.getBigDecimal(
                        "resolved_amount"
                ),
                rs.getBigDecimal(
                        "remaining_residual_amount"
                ),
                rs.getInt(
                        "item_count"
                ),
                rs.getInt(
                        "unresolved_item_count"
                ),
                rs.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                rs.getString(
                        "owner_name"
                ),
                FlywheelRemediationOutcomeStatus.valueOf(
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
                        "verified_by_user_id",
                        UUID.class
                ),
                instant(
                        rs,
                        "verified_at"
                ),
                rs.getString(
                        "verification_note"
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

    private FlywheelRemediationOutcomeItemResponse mapItem(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelRemediationOutcomeItemResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getObject(
                        "outcome_case_id",
                        UUID.class
                ),
                rs.getObject(
                        "source_remediation_item_id",
                        UUID.class
                ),
                FlywheelResidualRemediationAction.valueOf(
                        rs.getString(
                                "source_action"
                        )
                ),
                rs.getBigDecimal(
                        "source_residual_amount"
                ),
                FlywheelRemediationResolutionType.valueOf(
                        rs.getString(
                                "resolution_type"
                        )
                ),
                rs.getBigDecimal(
                        "resolved_amount"
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

    private FlywheelRemediationOutcomeSnapshotSummaryResponse mapSnapshot(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelRemediationOutcomeSnapshotSummaryResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "snapshot_number"
                ),
                rs.getObject(
                        "outcome_case_id",
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
                        "source_residual_amount"
                ),
                rs.getBigDecimal(
                        "resolved_amount"
                ),
                rs.getBigDecimal(
                        "remaining_residual_amount"
                ),
                rs.getInt(
                        "item_count"
                ),
                rs.getInt(
                        "unresolved_item_count"
                ),
                FlywheelRemediationOutcomeStatus.valueOf(
                        rs.getString(
                                "outcome_status"
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

    private FlywheelRemediationOutcomeSnapshotItemResponse mapSnapshotItem(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelRemediationOutcomeSnapshotItemResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getObject(
                        "snapshot_id",
                        UUID.class
                ),
                rs.getObject(
                        "outcome_item_id",
                        UUID.class
                ),
                rs.getObject(
                        "source_remediation_item_id",
                        UUID.class
                ),
                FlywheelResidualRemediationAction.valueOf(
                        rs.getString(
                                "source_action"
                        )
                ),
                rs.getBigDecimal(
                        "source_residual_amount"
                ),
                FlywheelRemediationResolutionType.valueOf(
                        rs.getString(
                                "resolution_type"
                        )
                ),
                rs.getBigDecimal(
                        "resolved_amount"
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
