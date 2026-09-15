package com.procureiq.strategyexecution;

import com.procureiq.strategycockpit.BoardDimensionKey;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class StrategyExecutionRepository {

    private final JdbcTemplate jdbcTemplate;

    public StrategyExecutionRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCommitmentSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategy_execution_commitment_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextReviewSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategy_execution_review_number_seq'
                )
                """,
                Long.class
        );
    }

    public void createCommitment(
            UUID commitmentId,
            String commitmentNumber,
            UUID roadmapId,
            String roadmapNumber,
            String roadmapTitle,
            UUID initiativeId,
            String initiativeNumber,
            String initiativeTitle,
            BoardDimensionKey dimensionKey,
            UUID ownerUserId,
            String ownerName,
            String currency,
            int fiscalYear,
            LocalDate plannedStartDate,
            LocalDate plannedEndDate,
            BigDecimal plannedContributionPoints,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_execution_commitments (
                    id,
                    commitment_number,
                    source_roadmap_id,
                    source_roadmap_number,
                    source_roadmap_title,
                    source_initiative_id,
                    source_initiative_number,
                    source_initiative_title,
                    dimension_key,
                    owner_user_id,
                    owner_name_snapshot,
                    currency,
                    fiscal_year,
                    planned_start_date,
                    planned_end_date,
                    planned_contribution_points,
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
                    'PLANNED',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                commitmentId,
                commitmentNumber,
                roadmapId,
                roadmapNumber,
                roadmapTitle,
                initiativeId,
                initiativeNumber,
                initiativeTitle,
                dimensionKey.name(),
                ownerUserId,
                ownerName,
                currency,
                fiscalYear,
                plannedStartDate,
                plannedEndDate,
                plannedContributionPoints,
                currentUserId
        );
    }

    public CommitmentRow findCommitment(
            UUID commitmentId
    ) {
        return jdbcTemplate.query(
                commitmentSql()
                        + """
                        WHERE commitment.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCommitment(
                                resultSet
                        ),
                commitmentId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public CommitmentRow findCommitmentBySourceInitiative(
            UUID initiativeId
    ) {
        return jdbcTemplate.query(
                commitmentSql()
                        + """
                        WHERE commitment.source_initiative_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCommitment(
                                resultSet
                        ),
                initiativeId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<CommitmentRow> commitments() {
        return jdbcTemplate.query(
                commitmentSql()
                        + """
                        ORDER BY
                            CASE commitment.status
                                WHEN 'IN_PROGRESS'
                                THEN 1
                                WHEN 'PLANNED'
                                THEN 2
                                WHEN 'COMPLETED'
                                THEN 3
                                ELSE 4
                            END,
                            commitment.planned_end_date,
                            commitment.commitment_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCommitment(
                                resultSet
                        )
        );
    }

    public List<CommitmentRow> commitmentsForRoadmap(
            UUID roadmapId
    ) {
        return jdbcTemplate.query(
                commitmentSql()
                        + """
                        WHERE commitment.source_roadmap_id = ?

                        ORDER BY
                            commitment.planned_end_date,
                            commitment.commitment_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCommitment(
                                resultSet
                        ),
                roadmapId
        );
    }

    public void startCommitment(
            UUID commitmentId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_execution_commitments

                SET
                    status =
                        'IN_PROGRESS',

                    actual_start_at =
                        COALESCE(
                            actual_start_at,
                            CURRENT_TIMESTAMP
                        ),

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'PLANNED'
                """,
                commitmentId
        );
    }

    public void completeCommitment(
            UUID commitmentId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_execution_commitments

                SET
                    status =
                        'COMPLETED',

                    actual_completed_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'IN_PROGRESS'
                """,
                commitmentId
        );
    }

    public void cancelCommitment(
            UUID commitmentId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_execution_commitments

                SET
                    status =
                        'CANCELLED',

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
                commitmentId
        );
    }

    public void createProgress(
            UUID progressId,
            UUID commitmentId,
            ExecutionProgressInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_execution_progress_updates (
                    id,
                    commitment_id,
                    progress_pct,
                    forecast_end_date,
                    blocker_count,
                    blocker_summary,
                    update_note,
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
                    CURRENT_TIMESTAMP
                )
                """,
                progressId,
                commitmentId,
                input.progressPct(),
                input.forecastEndDate(),
                input.blockerCount(),
                normalizeOptional(
                        input.blockerSummary()
                ),
                input.updateNote()
                        .trim(),
                currentUserId
        );
    }

    public ProgressRow latestProgress(
            UUID commitmentId
    ) {
        return jdbcTemplate.query(
                progressSql()
                        + """
                        WHERE progress.commitment_id = ?

                        ORDER BY
                            progress.created_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapProgress(
                                resultSet
                        ),
                commitmentId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ProgressRow> progressHistory(
            UUID commitmentId
    ) {
        return jdbcTemplate.query(
                progressSql()
                        + """
                        WHERE progress.commitment_id = ?

                        ORDER BY
                            progress.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapProgress(
                                resultSet
                        ),
                commitmentId
        );
    }

    public void createOutcomeReport(
            UUID reportId,
            UUID commitmentId,
            ExecutionOutcomeInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_execution_outcome_reports (
                    id,
                    commitment_id,
                    reported_contribution_points,
                    evidence_note,
                    reported_by_user_id,
                    reported_at
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
                reportId,
                commitmentId,
                input.reportedContributionPoints(),
                input.evidenceNote()
                        .trim(),
                currentUserId
        );
    }

    public OutcomeRow findOutcome(
            UUID outcomeId
    ) {
        return jdbcTemplate.query(
                outcomeSql()
                        + """
                        WHERE outcome.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapOutcome(
                                resultSet
                        ),
                outcomeId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public OutcomeRow latestOutcome(
            UUID commitmentId
    ) {
        return jdbcTemplate.query(
                outcomeSql()
                        + """
                        WHERE outcome.commitment_id = ?

                        ORDER BY
                            outcome.reported_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapOutcome(
                                resultSet
                        ),
                commitmentId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<OutcomeRow> outcomes(
            UUID commitmentId
    ) {
        return jdbcTemplate.query(
                outcomeSql()
                        + """
                        WHERE outcome.commitment_id = ?

                        ORDER BY
                            outcome.reported_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapOutcome(
                                resultSet
                        ),
                commitmentId
        );
    }

    public ValidationRow findValidationByOutcome(
            UUID outcomeId
    ) {
        return jdbcTemplate.query(
                validationSql()
                        + """
                        WHERE validation.outcome_report_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapValidation(
                                resultSet
                        ),
                outcomeId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void createValidation(
            UUID validationId,
            UUID outcomeId,
            ExecutionOutcomeValidationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_execution_outcome_validations (
                    id,
                    outcome_report_id,
                    decision,
                    validated_contribution_points,
                    validation_note,
                    validated_by_user_id,
                    validated_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                validationId,
                outcomeId,
                input.decision()
                        .name(),
                input.decision()
                        == ExecutionValidationDecision.VALIDATED
                        ? input.validatedContributionPoints()
                        : null,
                input.validationNote()
                        .trim(),
                currentUserId
        );
    }

    public void createReview(
            UUID reviewId,
            String reviewNumber,
            UUID roadmapId,
            String roadmapNumber,
            String roadmapTitle,
            StrategyExecutionSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_execution_reviews (
                    id,
                    review_number,
                    roadmap_id,
                    roadmap_number,
                    roadmap_title,
                    commitment_count,
                    completed_commitment_count,
                    blocked_commitment_count,
                    at_risk_commitment_count,
                    overdue_commitment_count,
                    planned_contribution_points,
                    reported_contribution_points,
                    validated_contribution_points,
                    value_at_risk_points,
                    average_progress_pct,
                    schedule_health_pct,
                    outcome_validation_pct,
                    execution_score,
                    execution_health,
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
                reviewId,
                reviewNumber,
                roadmapId,
                roadmapNumber,
                roadmapTitle,
                summary.commitmentCount(),
                summary.completedCommitmentCount(),
                summary.blockedCommitmentCount(),
                summary.atRiskCommitmentCount(),
                summary.overdueCommitmentCount(),
                summary.plannedContributionPoints(),
                summary.reportedContributionPoints(),
                summary.validatedContributionPoints(),
                summary.valueAtRiskPoints(),
                summary.averageProgressPct(),
                summary.scheduleHealthPct(),
                summary.outcomeValidationPct(),
                summary.executionScore(),
                summary.executionHealth()
                        .name(),
                currentUserId
        );
    }

    public void createReviewItem(
            UUID reviewId,
            ExecutionCommitmentResponse commitment
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_execution_review_items (
                    id,
                    review_id,
                    commitment_id,
                    commitment_number,
                    initiative_number,
                    initiative_title,
                    owner_name,
                    status,
                    execution_health,
                    progress_pct,
                    planned_end_date,
                    forecast_end_date,
                    blocker_count,
                    planned_contribution_points,
                    reported_contribution_points,
                    validated_contribution_points,
                    value_at_risk_points,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                reviewId,
                commitment.id(),
                commitment.commitmentNumber(),
                commitment.sourceInitiativeNumber(),
                commitment.sourceInitiativeTitle(),
                commitment.ownerName(),
                commitment.status()
                        .name(),
                commitment.health()
                        .name(),
                commitment.progressPct(),
                commitment.plannedEndDate(),
                commitment.forecastEndDate(),
                commitment.blockerCount(),
                commitment.plannedContributionPoints(),
                commitment.reportedContributionPoints(),
                commitment.validatedContributionPoints(),
                commitment.valueAtRiskPoints()
        );
    }

    public ReviewRow findReview(
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        WHERE review.id = ?
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
                            review.captured_at DESC

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
                    commitment_id,
                    commitment_number,
                    initiative_number,
                    initiative_title,
                    owner_name,
                    status,
                    execution_health,
                    progress_pct,
                    planned_end_date,
                    forecast_end_date,
                    blocker_count,
                    planned_contribution_points,
                    reported_contribution_points,
                    validated_contribution_points,
                    value_at_risk_points

                FROM procurement_strategy_execution_review_items

                WHERE review_id = ?

                ORDER BY
                    CASE execution_health
                        WHEN 'BLOCKED'
                        THEN 1
                        WHEN 'OVERDUE'
                        THEN 2
                        WHEN 'AT_RISK'
                        THEN 3
                        WHEN 'WATCH'
                        THEN 4
                        ELSE 5
                    END,
                    planned_end_date,
                    commitment_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ReviewItemRow(
                                resultSet.getObject(
                                        "commitment_id",
                                        UUID.class
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
                                        "owner_name"
                                ),
                                ExecutionCommitmentStatus.valueOf(
                                        resultSet.getString(
                                                "status"
                                        )
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
                                        "planned_end_date",
                                        LocalDate.class
                                ),
                                resultSet.getObject(
                                        "forecast_end_date",
                                        LocalDate.class
                                ),
                                resultSet.getInt(
                                        "blocker_count"
                                ),
                                resultSet.getBigDecimal(
                                        "planned_contribution_points"
                                ),
                                resultSet.getBigDecimal(
                                        "reported_contribution_points"
                                ),
                                resultSet.getBigDecimal(
                                        "validated_contribution_points"
                                ),
                                resultSet.getBigDecimal(
                                        "value_at_risk_points"
                                )
                        ),
                reviewId
        );
    }

    private String commitmentSql() {
        return """
                SELECT
                    commitment.id,
                    commitment.commitment_number,
                    commitment.source_roadmap_id,
                    commitment.source_roadmap_number,
                    commitment.source_roadmap_title,
                    commitment.source_initiative_id,
                    commitment.source_initiative_number,
                    commitment.source_initiative_title,
                    commitment.dimension_key,
                    commitment.owner_user_id,
                    commitment.owner_name_snapshot,
                    commitment.currency,
                    commitment.fiscal_year,
                    commitment.planned_start_date,
                    commitment.planned_end_date,
                    commitment.planned_contribution_points,
                    commitment.status,
                    commitment.actual_start_at,
                    commitment.actual_completed_at,
                    commitment.cancelled_at,
                    commitment.created_at,
                    commitment.updated_at,
                    commitment.version

                FROM procurement_strategy_execution_commitments
                    commitment

                """;
    }

    private String progressSql() {
        return """
                SELECT
                    progress.id,
                    progress.commitment_id,
                    progress.progress_pct,
                    progress.forecast_end_date,
                    progress.blocker_count,
                    progress.blocker_summary,
                    progress.update_note,

                    creator.full_name
                        AS created_by_name,

                    progress.created_at

                FROM procurement_strategy_execution_progress_updates
                    progress

                JOIN app_users
                    creator
                    ON creator.id =
                       progress.created_by_user_id

                """;
    }

    private String outcomeSql() {
        return """
                SELECT
                    outcome.id,
                    outcome.commitment_id,
                    outcome.reported_contribution_points,
                    outcome.evidence_note,

                    reporter.full_name
                        AS reported_by_name,

                    outcome.reported_at

                FROM procurement_strategy_execution_outcome_reports
                    outcome

                JOIN app_users
                    reporter
                    ON reporter.id =
                       outcome.reported_by_user_id

                """;
    }

    private String validationSql() {
        return """
                SELECT
                    validation.id,
                    validation.outcome_report_id,
                    validation.decision,
                    validation.validated_contribution_points,
                    validation.validation_note,

                    validator.full_name
                        AS validated_by_name,

                    validation.validated_at

                FROM procurement_strategy_execution_outcome_validations
                    validation

                JOIN app_users
                    validator
                    ON validator.id =
                       validation.validated_by_user_id

                """;
    }

    private String reviewSql() {
        return """
                SELECT
                    review.id,
                    review.review_number,
                    review.roadmap_id,
                    review.roadmap_number,
                    review.roadmap_title,
                    review.commitment_count,
                    review.completed_commitment_count,
                    review.blocked_commitment_count,
                    review.at_risk_commitment_count,
                    review.overdue_commitment_count,
                    review.planned_contribution_points,
                    review.reported_contribution_points,
                    review.validated_contribution_points,
                    review.value_at_risk_points,
                    review.average_progress_pct,
                    review.schedule_health_pct,
                    review.outcome_validation_pct,
                    review.execution_score,
                    review.execution_health,

                    user_account.full_name
                        AS captured_by_name,

                    review.captured_at

                FROM procurement_strategy_execution_reviews
                    review

                JOIN app_users
                    user_account
                    ON user_account.id =
                       review.captured_by_user_id

                """;
    }

    private CommitmentRow mapCommitment(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new CommitmentRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "commitment_number"
                ),
                resultSet.getObject(
                        "source_roadmap_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_roadmap_number"
                ),
                resultSet.getString(
                        "source_roadmap_title"
                ),
                resultSet.getObject(
                        "source_initiative_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_initiative_number"
                ),
                resultSet.getString(
                        "source_initiative_title"
                ),
                BoardDimensionKey.valueOf(
                        resultSet.getString(
                                "dimension_key"
                        )
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name_snapshot"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getObject(
                        "planned_start_date",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "planned_end_date",
                        LocalDate.class
                ),
                resultSet.getBigDecimal(
                        "planned_contribution_points"
                ),
                ExecutionCommitmentStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                instant(
                        resultSet,
                        "actual_start_at"
                ),
                instant(
                        resultSet,
                        "actual_completed_at"
                ),
                instant(
                        resultSet,
                        "cancelled_at"
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

    private ProgressRow mapProgress(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ProgressRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "commitment_id",
                        UUID.class
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
                resultSet.getString(
                        "blocker_summary"
                ),
                resultSet.getString(
                        "update_note"
                ),
                resultSet.getString(
                        "created_by_name"
                ),
                resultSet.getTimestamp(
                        "created_at"
                )
                        .toInstant()
        );
    }

    private OutcomeRow mapOutcome(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new OutcomeRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "commitment_id",
                        UUID.class
                ),
                resultSet.getBigDecimal(
                        "reported_contribution_points"
                ),
                resultSet.getString(
                        "evidence_note"
                ),
                resultSet.getString(
                        "reported_by_name"
                ),
                resultSet.getTimestamp(
                        "reported_at"
                )
                        .toInstant()
        );
    }

    private ValidationRow mapValidation(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ValidationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "outcome_report_id",
                        UUID.class
                ),
                ExecutionValidationDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),
                resultSet.getBigDecimal(
                        "validated_contribution_points"
                ),
                resultSet.getString(
                        "validation_note"
                ),
                resultSet.getString(
                        "validated_by_name"
                ),
                resultSet.getTimestamp(
                        "validated_at"
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
                resultSet.getObject(
                        "roadmap_id",
                        UUID.class
                ),
                resultSet.getString(
                        "roadmap_number"
                ),
                resultSet.getString(
                        "roadmap_title"
                ),
                resultSet.getInt(
                        "commitment_count"
                ),
                resultSet.getInt(
                        "completed_commitment_count"
                ),
                resultSet.getInt(
                        "blocked_commitment_count"
                ),
                resultSet.getInt(
                        "at_risk_commitment_count"
                ),
                resultSet.getInt(
                        "overdue_commitment_count"
                ),
                resultSet.getBigDecimal(
                        "planned_contribution_points"
                ),
                resultSet.getBigDecimal(
                        "reported_contribution_points"
                ),
                resultSet.getBigDecimal(
                        "validated_contribution_points"
                ),
                resultSet.getBigDecimal(
                        "value_at_risk_points"
                ),
                resultSet.getBigDecimal(
                        "average_progress_pct"
                ),
                resultSet.getBigDecimal(
                        "schedule_health_pct"
                ),
                resultSet.getBigDecimal(
                        "outcome_validation_pct"
                ),
                resultSet.getBigDecimal(
                        "execution_score"
                ),
                ExecutionPortfolioHealth.valueOf(
                        resultSet.getString(
                                "execution_health"
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

    public record CommitmentRow(
            UUID id,
            String commitmentNumber,
            UUID sourceRoadmapId,
            String sourceRoadmapNumber,
            String sourceRoadmapTitle,
            UUID sourceInitiativeId,
            String sourceInitiativeNumber,
            String sourceInitiativeTitle,
            BoardDimensionKey dimensionKey,
            UUID ownerUserId,
            String ownerName,
            String currency,
            int fiscalYear,
            LocalDate plannedStartDate,
            LocalDate plannedEndDate,
            BigDecimal plannedContributionPoints,
            ExecutionCommitmentStatus status,
            Instant actualStartAt,
            Instant actualCompletedAt,
            Instant cancelledAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ProgressRow(
            UUID id,
            UUID commitmentId,
            BigDecimal progressPct,
            LocalDate forecastEndDate,
            int blockerCount,
            String blockerSummary,
            String updateNote,
            String createdByName,
            Instant createdAt
    ) {
    }

    public record OutcomeRow(
            UUID id,
            UUID commitmentId,
            BigDecimal reportedContributionPoints,
            String evidenceNote,
            String reportedByName,
            Instant reportedAt
    ) {
    }

    public record ValidationRow(
            UUID id,
            UUID outcomeReportId,
            ExecutionValidationDecision decision,
            BigDecimal validatedContributionPoints,
            String validationNote,
            String validatedByName,
            Instant validatedAt
    ) {
    }

    public record ReviewRow(
            UUID id,
            String reviewNumber,
            UUID roadmapId,
            String roadmapNumber,
            String roadmapTitle,
            int commitmentCount,
            int completedCommitmentCount,
            int blockedCommitmentCount,
            int atRiskCommitmentCount,
            int overdueCommitmentCount,
            BigDecimal plannedContributionPoints,
            BigDecimal reportedContributionPoints,
            BigDecimal validatedContributionPoints,
            BigDecimal valueAtRiskPoints,
            BigDecimal averageProgressPct,
            BigDecimal scheduleHealthPct,
            BigDecimal outcomeValidationPct,
            BigDecimal executionScore,
            ExecutionPortfolioHealth executionHealth,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record ReviewItemRow(
            UUID commitmentId,
            String commitmentNumber,
            String initiativeNumber,
            String initiativeTitle,
            String ownerName,
            ExecutionCommitmentStatus status,
            ExecutionCommitmentHealth executionHealth,
            BigDecimal progressPct,
            LocalDate plannedEndDate,
            LocalDate forecastEndDate,
            int blockerCount,
            BigDecimal plannedContributionPoints,
            BigDecimal reportedContributionPoints,
            BigDecimal validatedContributionPoints,
            BigDecimal valueAtRiskPoints
    ) {
    }
}
