package com.procureiq.flywheelremediation;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class FlywheelResidualRemediationRepository {

    private final JdbcTemplate jdbc;

    public FlywheelResidualRemediationRepository(
            JdbcTemplate jdbc
    ) {
        this.jdbc = jdbc;
    }

    private static final String SOURCE_SELECT =
            """
            SELECT
                source_case.id,
                source_case.title,
                source_case.currency,
                source_case.fiscal_year,
                metrics.financial_residual_amount,
                metrics.residual_item_count

            FROM procurement_variance_execution_cases source_case

            JOIN LATERAL (
                SELECT
                    COALESCE(
                        SUM(
                            source_item.source_variance_amount
                            - source_item.executed_amount
                        )
                        FILTER (
                            WHERE
                                source_item.source_variance_amount
                                - source_item.executed_amount
                                > 0
                        ),
                        0
                    ) AS financial_residual_amount,

                    COUNT(*)
                    FILTER (
                        WHERE
                            source_item.source_variance_amount
                            - source_item.executed_amount
                            > 0
                    ) AS residual_item_count

                FROM procurement_variance_execution_items source_item

                WHERE source_item.execution_case_id =
                    source_case.id
            ) metrics
                ON TRUE

            WHERE source_case.status IN (
                'VERIFIED',
                'CLOSED'
            )

            AND metrics.financial_residual_amount > 0
            """;

    private static final String PLAN_SELECT =
            """
            SELECT
                plan.id,
                plan.plan_number,
                plan.source_execution_case_id,
                plan.title,
                plan.currency,
                plan.fiscal_year,
                plan.source_residual_amount,
                plan.source_positive_item_count,

                COALESCE(
                    metrics.covered_residual_amount,
                    0
                ) AS covered_residual_amount,

                COALESCE(
                    metrics.recovery_follow_up_amount,
                    0
                ) AS recovery_follow_up_amount,

                COALESCE(
                    metrics.write_off_review_amount,
                    0
                ) AS write_off_review_amount,

                COALESCE(
                    metrics.investigation_escalation_amount,
                    0
                ) AS investigation_escalation_amount,

                COALESCE(
                    metrics.residual_acceptance_review_amount,
                    0
                ) AS residual_acceptance_review_amount,

                COALESCE(
                    metrics.item_count,
                    0
                ) AS item_count,

                plan.owner_user_id,
                plan.owner_name,
                plan.remediation_objective,
                plan.status,
                plan.review_submitted_by_user_id,
                plan.review_submitted_at,
                plan.approved_by_user_id,
                plan.approved_at,
                plan.approval_note,
                plan.closed_by_user_id,
                plan.closed_at,
                plan.close_note,
                plan.version,
                plan.created_by_user_id,
                plan.created_at,
                plan.updated_at

            FROM procurement_residual_remediation_plans plan

            LEFT JOIN (
                SELECT
                    remediation_plan_id,

                    SUM(
                        residual_amount
                    ) AS covered_residual_amount,

                    SUM(
                        residual_amount
                    )
                    FILTER (
                        WHERE remediation_action =
                            'RECOVERY_FOLLOW_UP'
                    ) AS recovery_follow_up_amount,

                    SUM(
                        residual_amount
                    )
                    FILTER (
                        WHERE remediation_action =
                            'WRITE_OFF_REVIEW'
                    ) AS write_off_review_amount,

                    SUM(
                        residual_amount
                    )
                    FILTER (
                        WHERE remediation_action =
                            'INVESTIGATION_ESCALATION'
                    ) AS investigation_escalation_amount,

                    SUM(
                        residual_amount
                    )
                    FILTER (
                        WHERE remediation_action =
                            'RESIDUAL_ACCEPTANCE_REVIEW'
                    ) AS residual_acceptance_review_amount,

                    COUNT(*) AS item_count

                FROM procurement_residual_remediation_items

                GROUP BY
                    remediation_plan_id
            ) metrics
                ON metrics.remediation_plan_id =
                   plan.id
            """;

    public FlywheelResidualRemediationActor actor(
            UUID id
    ) {
        List<FlywheelResidualRemediationActor> rows =
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
                                new FlywheelResidualRemediationActor(
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

    public List<FlywheelResidualRemediationSourceResponse> eligibleSources() {
        return jdbc.query(
                SOURCE_SELECT
                        + """
                          AND NOT EXISTS (
                              SELECT 1

                              FROM procurement_residual_remediation_plans existing

                              WHERE existing.source_execution_case_id =
                                  source_case.id
                          )

                          ORDER BY
                              metrics.financial_residual_amount DESC,
                              source_case.created_at DESC
                          """,
                this::mapSource
        );
    }

    public FlywheelResidualRemediationSourceResponse source(
            UUID id
    ) {
        List<FlywheelResidualRemediationSourceResponse> rows =
                jdbc.query(
                        SOURCE_SELECT
                                + """
                                  AND source_case.id = ?
                                  """,
                        this::mapSource,
                        id
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }

    public List<FlywheelResidualRemediationCandidateResponse> candidates(
            UUID executionCaseId
    ) {
        return jdbc.query(
                """
                SELECT
                    source_item.id,
                    source_item.source_decision,
                    source_item.source_variance_amount,
                    source_item.executed_amount,

                    source_item.source_variance_amount
                    - source_item.executed_amount
                        AS residual_amount

                FROM procurement_variance_execution_items source_item

                WHERE source_item.execution_case_id = ?

                AND
                    source_item.source_variance_amount
                    - source_item.executed_amount
                    > 0

                ORDER BY
                    residual_amount DESC,
                    source_item.id
                """,
                (
                        rs,
                        row
                ) ->
                        new FlywheelResidualRemediationCandidateResponse(
                                rs.getObject(
                                        "id",
                                        UUID.class
                                ),
                                FlywheelVarianceDecision.valueOf(
                                        rs.getString(
                                                "source_decision"
                                        )
                                ),
                                rs.getBigDecimal(
                                        "source_variance_amount"
                                ),
                                rs.getBigDecimal(
                                        "executed_amount"
                                ),
                                rs.getBigDecimal(
                                        "residual_amount"
                                )
                        ),
                executionCaseId
        );
    }

    public boolean hasPlanForSource(
            UUID sourceCaseId
    ) {
        Boolean exists =
                jdbc.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1

                            FROM procurement_residual_remediation_plans

                            WHERE source_execution_case_id = ?
                        )
                        """,
                        Boolean.class,
                        sourceCaseId
                );

        return Boolean.TRUE.equals(
                exists
        );
    }

    public String nextPlanNumber() {
        Long sequence =
                jdbc.queryForObject(
                        """
                        SELECT nextval(
                            'procurement_residual_remediation_plan_number_seq'
                        )
                        """,
                        Long.class
                );

        return "RRP-%08d".formatted(
                sequence
        );
    }

    public String nextSnapshotNumber() {
        Long sequence =
                jdbc.queryForObject(
                        """
                        SELECT nextval(
                            'procurement_residual_remediation_snapshot_number_seq'
                        )
                        """,
                        Long.class
                );

        return "RRS-%08d".formatted(
                sequence
        );
    }

    public int createPlan(
            UUID id,
            String planNumber,
            FlywheelResidualRemediationSourceResponse source,
            String title,
            String objective,
            FlywheelResidualRemediationActor actor
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_residual_remediation_plans (
                    id,
                    plan_number,
                    source_execution_case_id,
                    title,
                    currency,
                    fiscal_year,
                    source_residual_amount,
                    source_positive_item_count,
                    owner_user_id,
                    owner_name,
                    remediation_objective,
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
                planNumber,
                source.executionCaseId(),
                title,
                source.currency(),
                source.fiscalYear(),
                source.financialResidualAmount(),
                source.residualItemCount(),
                actor.id(),
                actor.fullName(),
                objective,
                actor.id()
        );
    }

    public List<FlywheelResidualRemediationPlanResponse> plans() {
        return jdbc.query(
                PLAN_SELECT
                        + """
                          ORDER BY
                              plan.created_at DESC
                          """,
                this::mapPlan
        );
    }

    public FlywheelResidualRemediationPlanResponse plan(
            UUID id
    ) {
        List<FlywheelResidualRemediationPlanResponse> rows =
                jdbc.query(
                        PLAN_SELECT
                                + """
                                  WHERE plan.id = ?
                                  """,
                        this::mapPlan,
                        id
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }

    public int createItem(
            UUID id,
            UUID planId,
            FlywheelResidualRemediationCandidateResponse source,
            FlywheelResidualRemediationItemInput input,
            UUID actorId
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_residual_remediation_items (
                    id,
                    remediation_plan_id,
                    source_execution_item_id,
                    source_decision,
                    source_variance_amount,
                    source_executed_amount,
                    residual_amount,
                    remediation_action,
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
                planId,
                source.executionItemId(),
                source.sourceDecision().name(),
                source.sourceVarianceAmount(),
                source.sourceExecutedAmount(),
                source.residualAmount(),
                input.action().name(),
                input.targetDate(),
                input.rationale().trim(),
                actorId
        );
    }

    public List<FlywheelResidualRemediationItemResponse> items(
            UUID planId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    remediation_plan_id,
                    source_execution_item_id,
                    source_decision,
                    source_variance_amount,
                    source_executed_amount,
                    residual_amount,
                    remediation_action,
                    target_date,
                    rationale,
                    created_by_user_id,
                    created_at

                FROM procurement_residual_remediation_items

                WHERE remediation_plan_id = ?

                ORDER BY
                    created_at,
                    id
                """,
                this::item,
                planId
        );
    }

    public int submit(
            UUID planId,
            UUID actorId
    ) {
        return jdbc.update(
                """
                UPDATE procurement_residual_remediation_plans

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
                planId
        );
    }

    public int approve(
            UUID planId,
            UUID actorId,
            String note
    ) {
        return jdbc.update(
                """
                UPDATE procurement_residual_remediation_plans

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
                planId
        );
    }

    public int close(
            UUID planId,
            UUID actorId,
            String note
    ) {
        return jdbc.update(
                """
                UPDATE procurement_residual_remediation_plans

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
                planId
        );
    }

    public int createSnapshot(
            UUID id,
            String snapshotNumber,
            FlywheelResidualRemediationPlanResponse plan,
            UUID actorId
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_residual_remediation_snapshots (
                    id,
                    snapshot_number,
                    remediation_plan_id,
                    plan_number,
                    title,
                    currency,
                    fiscal_year,
                    source_residual_amount,
                    recovery_follow_up_amount,
                    write_off_review_amount,
                    investigation_escalation_amount,
                    residual_acceptance_review_amount,
                    item_count,
                    plan_status,
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
                plan.id(),
                plan.planNumber(),
                plan.title(),
                plan.currency(),
                plan.fiscalYear(),
                plan.sourceResidualAmount(),
                plan.recoveryFollowUpAmount(),
                plan.writeOffReviewAmount(),
                plan.investigationEscalationAmount(),
                plan.residualAcceptanceReviewAmount(),
                plan.itemCount(),
                plan.status().name(),
                actorId
        );
    }

    public int createSnapshotItem(
            UUID snapshotId,
            FlywheelResidualRemediationItemResponse item
    ) {
        return jdbc.update(
                """
                INSERT INTO procurement_residual_remediation_snapshot_items (
                    id,
                    snapshot_id,
                    remediation_item_id,
                    source_execution_item_id,
                    source_decision,
                    source_variance_amount,
                    source_executed_amount,
                    residual_amount,
                    remediation_action,
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
                item.sourceExecutionItemId(),
                item.sourceDecision().name(),
                item.sourceVarianceAmount(),
                item.sourceExecutedAmount(),
                item.residualAmount(),
                item.action().name(),
                item.targetDate(),
                item.rationale()
        );
    }

    public int sealSnapshot(
            UUID snapshotId
    ) {
        return jdbc.update(
                """
                UPDATE procurement_residual_remediation_snapshots

                SET sealed = TRUE

                WHERE id = ?
                AND sealed = FALSE
                """,
                snapshotId
        );
    }

    public List<FlywheelResidualRemediationSnapshotSummaryResponse> snapshots(
            UUID planId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    snapshot_number,
                    remediation_plan_id,
                    plan_number,
                    title,
                    currency,
                    fiscal_year,
                    source_residual_amount,
                    recovery_follow_up_amount,
                    write_off_review_amount,
                    investigation_escalation_amount,
                    residual_acceptance_review_amount,
                    item_count,
                    plan_status,
                    captured_by_user_id,
                    captured_at,
                    sealed

                FROM procurement_residual_remediation_snapshots

                WHERE remediation_plan_id = ?

                ORDER BY
                    captured_at DESC,
                    id DESC
                """,
                this::mapSnapshot,
                planId
        );
    }

    public FlywheelResidualRemediationSnapshotSummaryResponse snapshot(
            UUID id
    ) {
        List<FlywheelResidualRemediationSnapshotSummaryResponse> rows =
                jdbc.query(
                        """
                        SELECT
                            id,
                            snapshot_number,
                            remediation_plan_id,
                            plan_number,
                            title,
                            currency,
                            fiscal_year,
                            source_residual_amount,
                            recovery_follow_up_amount,
                            write_off_review_amount,
                            investigation_escalation_amount,
                            residual_acceptance_review_amount,
                            item_count,
                            plan_status,
                            captured_by_user_id,
                            captured_at,
                            sealed

                        FROM procurement_residual_remediation_snapshots

                        WHERE id = ?
                        """,
                        this::mapSnapshot,
                        id
                );

        return rows.isEmpty()
                ? null
                : rows.getFirst();
    }

    public List<FlywheelResidualRemediationSnapshotItemResponse> snapshotItems(
            UUID snapshotId
    ) {
        return jdbc.query(
                """
                SELECT
                    id,
                    snapshot_id,
                    remediation_item_id,
                    source_execution_item_id,
                    source_decision,
                    source_variance_amount,
                    source_executed_amount,
                    residual_amount,
                    remediation_action,
                    target_date,
                    rationale

                FROM procurement_residual_remediation_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY id
                """,
                this::snapshotItem,
                snapshotId
        );
    }

    private FlywheelResidualRemediationSourceResponse mapSource(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelResidualRemediationSourceResponse(
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
                        "financial_residual_amount"
                ),
                rs.getInt(
                        "residual_item_count"
                )
        );
    }

    private FlywheelResidualRemediationPlanResponse mapPlan(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelResidualRemediationPlanResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "plan_number"
                ),
                rs.getObject(
                        "source_execution_case_id",
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
                        "source_positive_item_count"
                ),
                rs.getBigDecimal(
                        "covered_residual_amount"
                ),
                rs.getBigDecimal(
                        "recovery_follow_up_amount"
                ),
                rs.getBigDecimal(
                        "write_off_review_amount"
                ),
                rs.getBigDecimal(
                        "investigation_escalation_amount"
                ),
                rs.getBigDecimal(
                        "residual_acceptance_review_amount"
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
                rs.getString(
                        "remediation_objective"
                ),
                FlywheelResidualRemediationPlanStatus.valueOf(
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

    private FlywheelResidualRemediationItemResponse item(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelResidualRemediationItemResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getObject(
                        "remediation_plan_id",
                        UUID.class
                ),
                rs.getObject(
                        "source_execution_item_id",
                        UUID.class
                ),
                FlywheelVarianceDecision.valueOf(
                        rs.getString(
                                "source_decision"
                        )
                ),
                rs.getBigDecimal(
                        "source_variance_amount"
                ),
                rs.getBigDecimal(
                        "source_executed_amount"
                ),
                rs.getBigDecimal(
                        "residual_amount"
                ),
                FlywheelResidualRemediationAction.valueOf(
                        rs.getString(
                                "remediation_action"
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

    private FlywheelResidualRemediationSnapshotSummaryResponse mapSnapshot(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelResidualRemediationSnapshotSummaryResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getString(
                        "snapshot_number"
                ),
                rs.getObject(
                        "remediation_plan_id",
                        UUID.class
                ),
                rs.getString(
                        "plan_number"
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
                        "recovery_follow_up_amount"
                ),
                rs.getBigDecimal(
                        "write_off_review_amount"
                ),
                rs.getBigDecimal(
                        "investigation_escalation_amount"
                ),
                rs.getBigDecimal(
                        "residual_acceptance_review_amount"
                ),
                rs.getInt(
                        "item_count"
                ),
                FlywheelResidualRemediationPlanStatus.valueOf(
                        rs.getString(
                                "plan_status"
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

    private FlywheelResidualRemediationSnapshotItemResponse snapshotItem(
            ResultSet rs,
            int row
    ) throws SQLException {
        return new FlywheelResidualRemediationSnapshotItemResponse(
                rs.getObject(
                        "id",
                        UUID.class
                ),
                rs.getObject(
                        "snapshot_id",
                        UUID.class
                ),
                rs.getObject(
                        "remediation_item_id",
                        UUID.class
                ),
                rs.getObject(
                        "source_execution_item_id",
                        UUID.class
                ),
                FlywheelVarianceDecision.valueOf(
                        rs.getString(
                                "source_decision"
                        )
                ),
                rs.getBigDecimal(
                        "source_variance_amount"
                ),
                rs.getBigDecimal(
                        "source_executed_amount"
                ),
                rs.getBigDecimal(
                        "residual_amount"
                ),
                FlywheelResidualRemediationAction.valueOf(
                        rs.getString(
                                "remediation_action"
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
