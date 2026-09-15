package com.procureiq.strategyrecovery;

import com.procureiq.strategyexecution.ExecutionCommitmentHealth;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class StrategyRecoveryRepository {

    private final JdbcTemplate jdbcTemplate;

    public StrategyRecoveryRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextRecoverySequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategy_recovery_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextReviewSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategy_recovery_review_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<RecoveryUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role

                FROM app_users

                WHERE active =
                    TRUE

                AND role
                    <> 'REQUESTER'

                ORDER BY
                    full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new RecoveryUserOptionResponse(
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

    public void createCase(
            UUID caseId,
            String recoveryNumber,
            UUID commitmentId,
            String commitmentNumber,
            UUID roadmapId,
            String roadmapNumber,
            String initiativeNumber,
            String initiativeTitle,
            String executionOwnerName,
            UUID recoveryOwnerUserId,
            String recoveryOwnerName,
            RecoverySeverity severity,
            RecoveryCaseInput input,
            ExecutionCommitmentHealth baselineHealth,
            BigDecimal baselineProgressPct,
            LocalDate baselineForecastEndDate,
            int baselineBlockerCount,
            BigDecimal baselinePlannedContributionPoints,
            BigDecimal baselineValidatedContributionPoints,
            BigDecimal baselineValueAtRiskPoints,
            BigDecimal baselineRiskScore,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_recovery_cases (
                    id,
                    recovery_number,
                    commitment_id,
                    commitment_number,
                    roadmap_id,
                    roadmap_number,
                    initiative_number,
                    initiative_title,
                    execution_owner_name,
                    recovery_owner_user_id,
                    recovery_owner_name_snapshot,
                    severity,
                    status,
                    recovery_objective,
                    target_recovery_date,
                    baseline_execution_health,
                    baseline_progress_pct,
                    baseline_forecast_end_date,
                    baseline_blocker_count,
                    baseline_planned_contribution_points,
                    baseline_validated_contribution_points,
                    baseline_value_at_risk_points,
                    baseline_risk_score,
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
                    'OPEN',
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
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                caseId,
                recoveryNumber,
                commitmentId,
                commitmentNumber,
                roadmapId,
                roadmapNumber,
                initiativeNumber,
                initiativeTitle,
                executionOwnerName,
                recoveryOwnerUserId,
                recoveryOwnerName,
                severity.name(),
                input.recoveryObjective()
                        .trim(),
                input.targetRecoveryDate(),
                baselineHealth.name(),
                baselineProgressPct,
                baselineForecastEndDate,
                baselineBlockerCount,
                baselinePlannedContributionPoints,
                baselineValidatedContributionPoints,
                baselineValueAtRiskPoints,
                baselineRiskScore,
                currentUserId
        );
    }

    public CaseRow findCase(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE recovery_case.id = ?
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

    public CaseRow activeCaseForCommitment(
            UUID commitmentId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE recovery_case.commitment_id = ?
                        AND recovery_case.status
                            <> 'CLOSED'

                        ORDER BY
                            recovery_case.created_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        ),
                commitmentId
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
                            CASE recovery_case.status
                                WHEN 'READY_FOR_VERIFICATION'
                                THEN 1
                                WHEN 'IN_RECOVERY'
                                THEN 2
                                WHEN 'OPEN'
                                THEN 3
                                WHEN 'VERIFIED'
                                THEN 4
                                ELSE 5
                            END,

                            CASE recovery_case.severity
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                ELSE 3
                            END,

                            recovery_case.target_recovery_date,
                            recovery_case.recovery_number
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

    public void startRecovery(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_recovery_cases

                SET
                    status =
                        'IN_RECOVERY',

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'OPEN'
                """,
                caseId
        );
    }

    public void markReadyForVerification(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_recovery_cases

                SET
                    status =
                        'READY_FOR_VERIFICATION',

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'IN_RECOVERY'
                """,
                caseId
        );
    }

    public void verifyCase(
            UUID caseId,
            String verificationNote,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_recovery_cases

                SET
                    status =
                        'VERIFIED',

                    verification_note = ?,

                    verified_by_user_id = ?,

                    verified_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'READY_FOR_VERIFICATION'
                """,
                verificationNote.trim(),
                currentUserId,
                caseId
        );
    }

    public void closeCase(
            UUID caseId,
            String closeNote,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_recovery_cases

                SET
                    status =
                        'CLOSED',

                    close_note = ?,

                    closed_by_user_id = ?,

                    closed_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'VERIFIED'
                """,
                closeNote.trim(),
                currentUserId,
                caseId
        );
    }

    public void createAction(
            UUID actionId,
            UUID caseId,
            RecoveryActionInput input,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_recovery_actions (
                    id,
                    recovery_case_id,
                    title,
                    description,
                    owner_user_id,
                    owner_name_snapshot,
                    due_date,
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
                    'PLANNED',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                actionId,
                caseId,
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                input.ownerUserId(),
                ownerName,
                input.dueDate(),
                currentUserId
        );
    }

    public ActionRow findAction(
            UUID actionId
    ) {
        return jdbcTemplate.query(
                actionSql()
                        + """
                        WHERE recovery_action.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAction(
                                resultSet
                        ),
                actionId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ActionRow> actions(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                actionSql()
                        + """
                        WHERE recovery_action.recovery_case_id = ?

                        ORDER BY
                            CASE recovery_action.status
                                WHEN 'IN_PROGRESS'
                                THEN 1
                                WHEN 'PLANNED'
                                THEN 2
                                WHEN 'COMPLETED'
                                THEN 3
                                ELSE 4
                            END,

                            recovery_action.due_date,
                            recovery_action.title
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAction(
                                resultSet
                        ),
                caseId
        );
    }

    public void startAction(
            UUID actionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_recovery_actions

                SET
                    status =
                        'IN_PROGRESS',

                    started_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'PLANNED'
                """,
                actionId
        );
    }

    public void completeAction(
            UUID actionId,
            String evidence
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_recovery_actions

                SET
                    status =
                        'COMPLETED',

                    completion_evidence = ?,

                    completed_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status IN (
                    'PLANNED',
                    'IN_PROGRESS'
                )
                """,
                evidence.trim(),
                actionId
        );
    }

    public void cancelAction(
            UUID actionId,
            String evidence
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_recovery_actions

                SET
                    status =
                        'CANCELLED',

                    completion_evidence = ?,

                    cancelled_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status IN (
                    'PLANNED',
                    'IN_PROGRESS'
                )
                """,
                evidence.trim(),
                actionId
        );
    }

    public void createCheckpoint(
            UUID checkpointId,
            UUID caseId,
            UUID commitmentId,
            ExecutionCommitmentHealth executionHealth,
            BigDecimal progressPct,
            LocalDate forecastEndDate,
            int blockerCount,
            BigDecimal validatedContributionPoints,
            BigDecimal valueAtRiskPoints,
            RecoveryMetricResult metric,
            String checkpointNote,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_recovery_checkpoints (
                    id,
                    recovery_case_id,
                    commitment_id,
                    execution_health,
                    progress_pct,
                    forecast_end_date,
                    blocker_count,
                    validated_contribution_points,
                    value_at_risk_points,
                    current_risk_score,
                    recovery_score,
                    effectiveness_pct,
                    recovery_health,
                    checkpoint_note,
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
                checkpointId,
                caseId,
                commitmentId,
                executionHealth.name(),
                progressPct,
                forecastEndDate,
                blockerCount,
                validatedContributionPoints,
                valueAtRiskPoints,
                metric.currentRiskScore(),
                metric.recoveryScore(),
                metric.effectivenessPct(),
                metric.recoveryHealth()
                        .name(),
                checkpointNote.trim(),
                currentUserId
        );
    }

    public List<CheckpointRow> checkpoints(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                checkpointSql()
                        + """
                        WHERE checkpoint.recovery_case_id = ?

                        ORDER BY
                            checkpoint.captured_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCheckpoint(
                                resultSet
                        ),
                caseId
        );
    }

    public void createEscalation(
            UUID escalationId,
            UUID caseId,
            RecoveryEscalationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_recovery_escalations (
                    id,
                    recovery_case_id,
                    escalation_level,
                    reason,
                    escalated_by_user_id,
                    escalated_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                escalationId,
                caseId,
                input.escalationLevel()
                        .name(),
                input.reason()
                        .trim(),
                currentUserId
        );
    }

    public List<EscalationRow> escalations(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                escalationSql()
                        + """
                        WHERE escalation.recovery_case_id = ?

                        ORDER BY
                            escalation.escalated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEscalation(
                                resultSet
                        ),
                caseId
        );
    }

    public void createReview(
            UUID reviewId,
            String reviewNumber,
            StrategyRecoverySummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_recovery_reviews (
                    id,
                    review_number,
                    open_case_count,
                    in_recovery_case_count,
                    ready_for_verification_count,
                    verified_case_count,
                    critical_case_count,
                    overdue_action_count,
                    escalation_count,
                    total_baseline_value_at_risk_points,
                    total_current_value_at_risk_points,
                    average_effectiveness_pct,
                    average_recovery_score,
                    portfolio_health,
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
                reviewId,
                reviewNumber,
                summary.openCaseCount(),
                summary.inRecoveryCaseCount(),
                summary.readyForVerificationCount(),
                summary.verifiedCaseCount(),
                summary.criticalCaseCount(),
                summary.overdueActionCount(),
                summary.escalationCount(),
                summary.totalBaselineValueAtRiskPoints(),
                summary.totalCurrentValueAtRiskPoints(),
                summary.averageEffectivenessPct(),
                summary.averageRecoveryScore(),
                summary.portfolioHealth()
                        .name(),
                currentUserId
        );
    }

    public void createReviewItem(
            UUID reviewId,
            RecoveryCaseResponse recoveryCase
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_recovery_review_items (
                    id,
                    review_id,
                    recovery_case_id,
                    recovery_number,
                    commitment_number,
                    initiative_number,
                    initiative_title,
                    recovery_owner_name,
                    severity,
                    recovery_status,
                    baseline_risk_score,
                    current_risk_score,
                    recovery_score,
                    effectiveness_pct,
                    recovery_health,
                    current_progress_pct,
                    current_forecast_end_date,
                    current_blocker_count,
                    current_value_at_risk_points,
                    verification_eligible,
                    open_action_count,
                    overdue_action_count,
                    escalation_count,
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
                reviewId,
                recoveryCase.id(),
                recoveryCase.recoveryNumber(),
                recoveryCase.commitmentNumber(),
                recoveryCase.initiativeNumber(),
                recoveryCase.initiativeTitle(),
                recoveryCase.recoveryOwnerName(),
                recoveryCase.severity()
                        .name(),
                recoveryCase.status()
                        .name(),
                recoveryCase.baselineRiskScore(),
                recoveryCase.currentRiskScore(),
                recoveryCase.recoveryScore(),
                recoveryCase.effectivenessPct(),
                recoveryCase.recoveryHealth()
                        .name(),
                recoveryCase.currentProgressPct(),
                recoveryCase.currentForecastEndDate(),
                recoveryCase.currentBlockerCount(),
                recoveryCase.currentValueAtRiskPoints(),
                recoveryCase.verificationEligible(),
                recoveryCase.openActionCount(),
                recoveryCase.overdueActionCount(),
                recoveryCase.escalationCount()
        );
    }

    public ReviewRow findReview(
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        WHERE recovery_review.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapReview(
                                resultSet
                        ),
                reviewId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ReviewRow> reviews() {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        ORDER BY
                            recovery_review.captured_at DESC

                        LIMIT 100
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapReview(
                                resultSet
                        )
        );
    }

    public List<ReviewItemRow> reviewItems(
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    recovery_case_id,
                    recovery_number,
                    commitment_number,
                    initiative_number,
                    initiative_title,
                    recovery_owner_name,
                    severity,
                    recovery_status,
                    baseline_risk_score,
                    current_risk_score,
                    recovery_score,
                    effectiveness_pct,
                    recovery_health,
                    current_progress_pct,
                    current_forecast_end_date,
                    current_blocker_count,
                    current_value_at_risk_points,
                    verification_eligible,
                    open_action_count,
                    overdue_action_count,
                    escalation_count

                FROM procurement_strategy_recovery_review_items

                WHERE review_id = ?

                ORDER BY
                    CASE severity
                        WHEN 'CRITICAL'
                        THEN 1
                        WHEN 'HIGH'
                        THEN 2
                        ELSE 3
                    END,

                    current_risk_score DESC,
                    recovery_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ReviewItemRow(
                                resultSet.getObject(
                                        "recovery_case_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "recovery_number"
                                ),
                                resultSet.getString(
                                        "commitment_number"
                                ),
                                resultSet.getString(
                                        "initiative_number"
                                ),
                                resultSet.getString(
                                        "initiative_title"
                                ),
                                resultSet.getString(
                                        "recovery_owner_name"
                                ),
                                RecoverySeverity.valueOf(
                                        resultSet.getString(
                                                "severity"
                                        )
                                ),
                                RecoveryCaseStatus.valueOf(
                                        resultSet.getString(
                                                "recovery_status"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_risk_score"
                                ),
                                resultSet.getBigDecimal(
                                        "current_risk_score"
                                ),
                                resultSet.getBigDecimal(
                                        "recovery_score"
                                ),
                                resultSet.getBigDecimal(
                                        "effectiveness_pct"
                                ),
                                RecoveryHealth.valueOf(
                                        resultSet.getString(
                                                "recovery_health"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "current_progress_pct"
                                ),
                                resultSet.getObject(
                                        "current_forecast_end_date",
                                        LocalDate.class
                                ),
                                resultSet.getInt(
                                        "current_blocker_count"
                                ),
                                resultSet.getBigDecimal(
                                        "current_value_at_risk_points"
                                ),
                                resultSet.getBoolean(
                                        "verification_eligible"
                                ),
                                resultSet.getInt(
                                        "open_action_count"
                                ),
                                resultSet.getInt(
                                        "overdue_action_count"
                                ),
                                resultSet.getInt(
                                        "escalation_count"
                                )
                        ),
                reviewId
        );
    }

    private String caseSql() {
        return """
                SELECT
                    recovery_case.id,
                    recovery_case.recovery_number,
                    recovery_case.commitment_id,
                    recovery_case.commitment_number,
                    recovery_case.roadmap_id,
                    recovery_case.roadmap_number,
                    recovery_case.initiative_number,
                    recovery_case.initiative_title,
                    recovery_case.execution_owner_name,
                    recovery_case.recovery_owner_user_id,
                    recovery_case.recovery_owner_name_snapshot,
                    recovery_case.severity,
                    recovery_case.status,
                    recovery_case.recovery_objective,
                    recovery_case.target_recovery_date,
                    recovery_case.baseline_execution_health,
                    recovery_case.baseline_progress_pct,
                    recovery_case.baseline_forecast_end_date,
                    recovery_case.baseline_blocker_count,
                    recovery_case.baseline_planned_contribution_points,
                    recovery_case.baseline_validated_contribution_points,
                    recovery_case.baseline_value_at_risk_points,
                    recovery_case.baseline_risk_score,
                    recovery_case.verification_note,

                    verifier.full_name
                        AS verified_by_name,

                    recovery_case.verified_at,
                    recovery_case.close_note,

                    closer.full_name
                        AS closed_by_name,

                    recovery_case.closed_at,
                    recovery_case.created_at,
                    recovery_case.updated_at,
                    recovery_case.version

                FROM procurement_strategy_recovery_cases
                    recovery_case

                LEFT JOIN app_users
                    verifier
                    ON verifier.id =
                       recovery_case.verified_by_user_id

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       recovery_case.closed_by_user_id

                """;
    }

    private String actionSql() {
        return """
                SELECT
                    recovery_action.id,
                    recovery_action.recovery_case_id,
                    recovery_action.title,
                    recovery_action.description,
                    recovery_action.owner_user_id,
                    recovery_action.owner_name_snapshot,
                    recovery_action.due_date,
                    recovery_action.status,
                    recovery_action.completion_evidence,
                    recovery_action.started_at,
                    recovery_action.completed_at,
                    recovery_action.cancelled_at,
                    recovery_action.created_at,
                    recovery_action.updated_at,
                    recovery_action.version

                FROM procurement_strategy_recovery_actions
                    recovery_action

                """;
    }

    private String checkpointSql() {
        return """
                SELECT
                    checkpoint.id,
                    checkpoint.recovery_case_id,
                    checkpoint.commitment_id,
                    checkpoint.execution_health,
                    checkpoint.progress_pct,
                    checkpoint.forecast_end_date,
                    checkpoint.blocker_count,
                    checkpoint.validated_contribution_points,
                    checkpoint.value_at_risk_points,
                    checkpoint.current_risk_score,
                    checkpoint.recovery_score,
                    checkpoint.effectiveness_pct,
                    checkpoint.recovery_health,
                    checkpoint.checkpoint_note,

                    user_account.full_name
                        AS captured_by_name,

                    checkpoint.captured_at

                FROM procurement_strategy_recovery_checkpoints
                    checkpoint

                JOIN app_users
                    user_account
                    ON user_account.id =
                       checkpoint.captured_by_user_id

                """;
    }

    private String escalationSql() {
        return """
                SELECT
                    escalation.id,
                    escalation.recovery_case_id,
                    escalation.escalation_level,
                    escalation.reason,

                    user_account.full_name
                        AS escalated_by_name,

                    escalation.escalated_at

                FROM procurement_strategy_recovery_escalations
                    escalation

                JOIN app_users
                    user_account
                    ON user_account.id =
                       escalation.escalated_by_user_id

                """;
    }

    private String reviewSql() {
        return """
                SELECT
                    recovery_review.id,
                    recovery_review.review_number,
                    recovery_review.open_case_count,
                    recovery_review.in_recovery_case_count,
                    recovery_review.ready_for_verification_count,
                    recovery_review.verified_case_count,
                    recovery_review.critical_case_count,
                    recovery_review.overdue_action_count,
                    recovery_review.escalation_count,
                    recovery_review.total_baseline_value_at_risk_points,
                    recovery_review.total_current_value_at_risk_points,
                    recovery_review.average_effectiveness_pct,
                    recovery_review.average_recovery_score,
                    recovery_review.portfolio_health,

                    user_account.full_name
                        AS captured_by_name,

                    recovery_review.captured_at

                FROM procurement_strategy_recovery_reviews
                    recovery_review

                JOIN app_users
                    user_account
                    ON user_account.id =
                       recovery_review.captured_by_user_id

                """;
    }

    private CaseRow mapCase(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new CaseRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "recovery_number"
                ),
                resultSet.getObject(
                        "commitment_id",
                        UUID.class
                ),
                resultSet.getString(
                        "commitment_number"
                ),
                resultSet.getObject(
                        "roadmap_id",
                        UUID.class
                ),
                resultSet.getString(
                        "roadmap_number"
                ),
                resultSet.getString(
                        "initiative_number"
                ),
                resultSet.getString(
                        "initiative_title"
                ),
                resultSet.getString(
                        "execution_owner_name"
                ),
                resultSet.getObject(
                        "recovery_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "recovery_owner_name_snapshot"
                ),
                RecoverySeverity.valueOf(
                        resultSet.getString(
                                "severity"
                        )
                ),
                RecoveryCaseStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "recovery_objective"
                ),
                resultSet.getObject(
                        "target_recovery_date",
                        LocalDate.class
                ),
                ExecutionCommitmentHealth.valueOf(
                        resultSet.getString(
                                "baseline_execution_health"
                        )
                ),
                resultSet.getBigDecimal(
                        "baseline_progress_pct"
                ),
                resultSet.getObject(
                        "baseline_forecast_end_date",
                        LocalDate.class
                ),
                resultSet.getInt(
                        "baseline_blocker_count"
                ),
                resultSet.getBigDecimal(
                        "baseline_planned_contribution_points"
                ),
                resultSet.getBigDecimal(
                        "baseline_validated_contribution_points"
                ),
                resultSet.getBigDecimal(
                        "baseline_value_at_risk_points"
                ),
                resultSet.getBigDecimal(
                        "baseline_risk_score"
                ),
                resultSet.getString(
                        "verification_note"
                ),
                resultSet.getString(
                        "verified_by_name"
                ),
                instant(
                        resultSet,
                        "verified_at"
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
                )
                        .toInstant(),
                resultSet.getTimestamp(
                        "updated_at"
                )
                        .toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private ActionRow mapAction(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ActionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "recovery_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name_snapshot"
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                RecoveryActionStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "completion_evidence"
                ),
                instant(
                        resultSet,
                        "started_at"
                ),
                instant(
                        resultSet,
                        "completed_at"
                ),
                instant(
                        resultSet,
                        "cancelled_at"
                ),
                resultSet.getTimestamp(
                        "created_at"
                )
                        .toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private CheckpointRow mapCheckpoint(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new CheckpointRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "recovery_case_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "commitment_id",
                        UUID.class
                ),
                ExecutionCommitmentHealth.valueOf(
                        resultSet.getString(
                                "execution_health"
                        )
                ),
                resultSet.getBigDecimal(
                        "progress_pct"
                ),
                resultSet.getObject(
                        "forecast_end_date",
                        LocalDate.class
                ),
                resultSet.getInt(
                        "blocker_count"
                ),
                resultSet.getBigDecimal(
                        "validated_contribution_points"
                ),
                resultSet.getBigDecimal(
                        "value_at_risk_points"
                ),
                resultSet.getBigDecimal(
                        "current_risk_score"
                ),
                resultSet.getBigDecimal(
                        "recovery_score"
                ),
                resultSet.getBigDecimal(
                        "effectiveness_pct"
                ),
                RecoveryHealth.valueOf(
                        resultSet.getString(
                                "recovery_health"
                        )
                ),
                resultSet.getString(
                        "checkpoint_note"
                ),
                resultSet.getString(
                        "captured_by_name"
                ),
                resultSet.getTimestamp(
                        "captured_at"
                )
                        .toInstant()
        );
    }

    private EscalationRow mapEscalation(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new EscalationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "recovery_case_id",
                        UUID.class
                ),
                RecoveryEscalationLevel.valueOf(
                        resultSet.getString(
                                "escalation_level"
                        )
                ),
                resultSet.getString(
                        "reason"
                ),
                resultSet.getString(
                        "escalated_by_name"
                ),
                resultSet.getTimestamp(
                        "escalated_at"
                )
                        .toInstant()
        );
    }

    private ReviewRow mapReview(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ReviewRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "review_number"
                ),
                resultSet.getInt(
                        "open_case_count"
                ),
                resultSet.getInt(
                        "in_recovery_case_count"
                ),
                resultSet.getInt(
                        "ready_for_verification_count"
                ),
                resultSet.getInt(
                        "verified_case_count"
                ),
                resultSet.getInt(
                        "critical_case_count"
                ),
                resultSet.getInt(
                        "overdue_action_count"
                ),
                resultSet.getInt(
                        "escalation_count"
                ),
                resultSet.getBigDecimal(
                        "total_baseline_value_at_risk_points"
                ),
                resultSet.getBigDecimal(
                        "total_current_value_at_risk_points"
                ),
                resultSet.getBigDecimal(
                        "average_effectiveness_pct"
                ),
                resultSet.getBigDecimal(
                        "average_recovery_score"
                ),
                RecoveryHealth.valueOf(
                        resultSet.getString(
                                "portfolio_health"
                        )
                ),
                resultSet.getString(
                        "captured_by_name"
                ),
                resultSet.getTimestamp(
                        "captured_at"
                )
                        .toInstant()
        );
    }

    private Instant instant(
            java.sql.ResultSet resultSet,
            String column
    ) throws java.sql.SQLException {
        Timestamp value =
                resultSet.getTimestamp(
                        column
                );

        return value == null
                ? null
                : value.toInstant();
    }

    private String normalizeOptional(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String normalized =
                value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }

    public record CaseRow(
            UUID id,
            String recoveryNumber,
            UUID commitmentId,
            String commitmentNumber,
            UUID roadmapId,
            String roadmapNumber,
            String initiativeNumber,
            String initiativeTitle,
            String executionOwnerName,
            UUID recoveryOwnerUserId,
            String recoveryOwnerName,
            RecoverySeverity severity,
            RecoveryCaseStatus status,
            String recoveryObjective,
            LocalDate targetRecoveryDate,
            ExecutionCommitmentHealth baselineExecutionHealth,
            BigDecimal baselineProgressPct,
            LocalDate baselineForecastEndDate,
            int baselineBlockerCount,
            BigDecimal baselinePlannedContributionPoints,
            BigDecimal baselineValidatedContributionPoints,
            BigDecimal baselineValueAtRiskPoints,
            BigDecimal baselineRiskScore,
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

    public record ActionRow(
            UUID id,
            UUID recoveryCaseId,
            String title,
            String description,
            UUID ownerUserId,
            String ownerName,
            LocalDate dueDate,
            RecoveryActionStatus status,
            String completionEvidence,
            Instant startedAt,
            Instant completedAt,
            Instant cancelledAt,
            Instant createdAt,
            long version
    ) {
    }

    public record CheckpointRow(
            UUID id,
            UUID recoveryCaseId,
            UUID commitmentId,
            ExecutionCommitmentHealth executionHealth,
            BigDecimal progressPct,
            LocalDate forecastEndDate,
            int blockerCount,
            BigDecimal validatedContributionPoints,
            BigDecimal valueAtRiskPoints,
            BigDecimal currentRiskScore,
            BigDecimal recoveryScore,
            BigDecimal effectivenessPct,
            RecoveryHealth recoveryHealth,
            String checkpointNote,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record EscalationRow(
            UUID id,
            UUID recoveryCaseId,
            RecoveryEscalationLevel escalationLevel,
            String reason,
            String escalatedByName,
            Instant escalatedAt
    ) {
    }

    public record ReviewRow(
            UUID id,
            String reviewNumber,
            int openCaseCount,
            int inRecoveryCaseCount,
            int readyForVerificationCount,
            int verifiedCaseCount,
            int criticalCaseCount,
            int overdueActionCount,
            int escalationCount,
            BigDecimal totalBaselineValueAtRiskPoints,
            BigDecimal totalCurrentValueAtRiskPoints,
            BigDecimal averageEffectivenessPct,
            BigDecimal averageRecoveryScore,
            RecoveryHealth portfolioHealth,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record ReviewItemRow(
            UUID recoveryCaseId,
            String recoveryNumber,
            String commitmentNumber,
            String initiativeNumber,
            String initiativeTitle,
            String recoveryOwnerName,
            RecoverySeverity severity,
            RecoveryCaseStatus recoveryStatus,
            BigDecimal baselineRiskScore,
            BigDecimal currentRiskScore,
            BigDecimal recoveryScore,
            BigDecimal effectivenessPct,
            RecoveryHealth recoveryHealth,
            BigDecimal currentProgressPct,
            LocalDate currentForecastEndDate,
            int currentBlockerCount,
            BigDecimal currentValueAtRiskPoints,
            boolean verificationEligible,
            int openActionCount,
            int overdueActionCount,
            int escalationCount
    ) {
    }
}
