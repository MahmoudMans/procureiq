package com.procureiq.outcomepersistence;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class OutcomePersistenceRepository {

    private final JdbcTemplate jdbcTemplate;

    public OutcomePersistenceRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextPlanSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_outcome_persistence_plan_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextReviewSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_outcome_persistence_review_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<PersistenceUserOptionResponse> users() {
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
                        new PersistenceUserOptionResponse(
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

    public void createPlan(
            UUID planId,
            String planNumber,
            UUID commitmentId,
            String commitmentNumber,
            UUID roadmapId,
            String roadmapNumber,
            String initiativeNumber,
            String initiativeTitle,
            String executionOwnerName,
            UUID persistenceOwnerUserId,
            String persistenceOwnerName,
            String currency,
            int fiscalYear,
            BigDecimal baselineValidatedContributionPoints,
            PersistencePlanInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_outcome_persistence_plans (
                    id,
                    plan_number,
                    commitment_id,
                    commitment_number,
                    roadmap_id,
                    roadmap_number,
                    initiative_number,
                    initiative_title,
                    execution_owner_name,
                    persistence_owner_user_id,
                    persistence_owner_name_snapshot,
                    currency,
                    fiscal_year,
                    baseline_validated_contribution_points,
                    observation_start_date,
                    observation_end_date,
                    minimum_persistence_pct,
                    persistence_objective,
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
                    'ACTIVE',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                planId,
                planNumber,
                commitmentId,
                commitmentNumber,
                roadmapId,
                roadmapNumber,
                initiativeNumber,
                initiativeTitle,
                executionOwnerName,
                persistenceOwnerUserId,
                persistenceOwnerName,
                currency,
                fiscalYear,
                baselineValidatedContributionPoints,
                input.observationStartDate(),
                input.observationEndDate(),
                input.minimumPersistencePct(),
                input.persistenceObjective()
                        .trim(),
                currentUserId
        );
    }

    public PlanRow findPlan(
            UUID planId
    ) {
        return jdbcTemplate.query(
                planSql()
                        + """
                        WHERE persistence_plan.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPlan(
                                resultSet
                        ),
                planId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public PlanRow activePlanForCommitment(
            UUID commitmentId
    ) {
        return jdbcTemplate.query(
                planSql()
                        + """
                        WHERE persistence_plan.commitment_id = ?
                        AND persistence_plan.status
                            <> 'CLOSED'

                        ORDER BY
                            persistence_plan.created_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPlan(
                                resultSet
                        ),
                commitmentId
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
                            CASE persistence_plan.status
                                WHEN 'READY_FOR_REVIEW'
                                THEN 1
                                WHEN 'IN_REMEDIATION'
                                THEN 2
                                WHEN 'ACTIVE'
                                THEN 3
                                WHEN 'SUSTAINED'
                                THEN 4
                                ELSE 5
                            END,

                            persistence_plan.observation_end_date,
                            persistence_plan.plan_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPlan(
                                resultSet
                        )
        );
    }

    public void markReadyForReview(
            UUID planId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_outcome_persistence_plans

                SET
                    status =
                        'READY_FOR_REVIEW',

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status IN (
                    'ACTIVE',
                    'IN_REMEDIATION'
                )
                """,
                planId
        );
    }

    public void markSustained(
            UUID planId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_outcome_persistence_plans

                SET
                    status =
                        'SUSTAINED',

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'READY_FOR_REVIEW'
                """,
                planId
        );
    }

    public void markRemediationRequired(
            UUID planId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_outcome_persistence_plans

                SET
                    status =
                        'IN_REMEDIATION',

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'READY_FOR_REVIEW'
                """,
                planId
        );
    }

    public void closePlan(
            UUID planId,
            String closeNote,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_outcome_persistence_plans

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
                    'SUSTAINED'
                """,
                closeNote.trim(),
                currentUserId,
                planId
        );
    }

    public void createObservation(
            UUID observationId,
            UUID planId,
            PersistenceObservationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_outcome_persistence_observations (
                    id,
                    plan_id,
                    observed_on,
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
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                observationId,
                planId,
                input.observedOn(),
                input.reportedContributionPoints(),
                input.evidenceNote()
                        .trim(),
                currentUserId
        );
    }

    public ObservationRow findObservation(
            UUID observationId
    ) {
        return jdbcTemplate.query(
                observationSql()
                        + """
                        WHERE observation.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapObservation(
                                resultSet
                        ),
                observationId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ObservationRow> observations(
            UUID planId
    ) {
        return jdbcTemplate.query(
                observationSql()
                        + """
                        WHERE observation.plan_id = ?

                        ORDER BY
                            observation.observed_on DESC,
                            observation.reported_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapObservation(
                                resultSet
                        ),
                planId
        );
    }

    public ValidatedObservationRow latestValidatedObservation(
            UUID planId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    observation.id
                        AS observation_id,

                    observation.observed_on,

                    validation.validated_contribution_points,

                    validation.validated_at

                FROM procurement_outcome_persistence_observations
                    observation

                JOIN procurement_outcome_persistence_validations
                    validation
                    ON validation.observation_id =
                       observation.id

                WHERE observation.plan_id = ?
                AND validation.decision =
                    'VALIDATED'

                ORDER BY
                    observation.observed_on DESC,
                    validation.validated_at DESC

                LIMIT 1
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ValidatedObservationRow(
                                resultSet.getObject(
                                        "observation_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "observed_on",
                                        LocalDate.class
                                ),
                                resultSet.getBigDecimal(
                                        "validated_contribution_points"
                                ),
                                resultSet.getTimestamp(
                                        "validated_at"
                                )
                                        .toInstant()
                        ),
                planId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public ValidationRow findValidation(
            UUID observationId
    ) {
        return jdbcTemplate.query(
                validationSql()
                        + """
                        WHERE validation.observation_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapValidation(
                                resultSet
                        ),
                observationId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void createValidation(
            UUID validationId,
            UUID observationId,
            PersistenceObservationValidationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_outcome_persistence_validations (
                    id,
                    observation_id,
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
                observationId,
                input.decision()
                        .name(),
                input.decision()
                        == PersistenceValidationDecision.VALIDATED
                        ? input.validatedContributionPoints()
                        : null,
                input.validationNote()
                        .trim(),
                currentUserId
        );
    }

    public void createControl(
            UUID controlId,
            UUID planId,
            PersistenceControlInput input,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_outcome_persistence_controls (
                    id,
                    plan_id,
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
                controlId,
                planId,
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

    public ControlRow findControl(
            UUID controlId
    ) {
        return jdbcTemplate.query(
                controlSql()
                        + """
                        WHERE persistence_control.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapControl(
                                resultSet
                        ),
                controlId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ControlRow> controls(
            UUID planId
    ) {
        return jdbcTemplate.query(
                controlSql()
                        + """
                        WHERE persistence_control.plan_id = ?

                        ORDER BY
                            CASE persistence_control.status
                                WHEN 'IN_PROGRESS'
                                THEN 1
                                WHEN 'PLANNED'
                                THEN 2
                                WHEN 'COMPLETED'
                                THEN 3
                                ELSE 4
                            END,

                            persistence_control.due_date,
                            persistence_control.title
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapControl(
                                resultSet
                        ),
                planId
        );
    }

    public void startControl(
            UUID controlId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_outcome_persistence_controls

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
                controlId
        );
    }

    public void completeControl(
            UUID controlId,
            String evidence
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_outcome_persistence_controls

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
                controlId
        );
    }

    public void cancelControl(
            UUID controlId,
            String evidence
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_outcome_persistence_controls

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
                controlId
        );
    }

    public void createVerification(
            UUID verificationId,
            UUID planId,
            PersistenceVerificationInput input,
            PersistenceMetricResult metric,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_outcome_persistence_verifications (
                    id,
                    plan_id,
                    decision,
                    persistence_pct,
                    decay_points,
                    persistence_health,
                    verification_note,
                    verified_by_user_id,
                    verified_at
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
                verificationId,
                planId,
                input.decision()
                        .name(),
                metric.persistencePct(),
                metric.decayPoints(),
                metric.health()
                        .name(),
                input.verificationNote()
                        .trim(),
                currentUserId
        );
    }

    public List<VerificationRow> verifications(
            UUID planId
    ) {
        return jdbcTemplate.query(
                verificationSql()
                        + """
                        WHERE verification.plan_id = ?

                        ORDER BY
                            verification.verified_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapVerification(
                                resultSet
                        ),
                planId
        );
    }

    public void createReview(
            UUID reviewId,
            String reviewNumber,
            OutcomePersistenceSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_outcome_persistence_reviews (
                    id,
                    review_number,
                    active_plan_count,
                    remediation_plan_count,
                    ready_for_review_count,
                    sustained_plan_count,
                    due_observation_count,
                    decayed_plan_count,
                    overdue_control_count,
                    assessed_baseline_points,
                    current_validated_points,
                    total_decay_points,
                    average_persistence_pct,
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
                summary.activePlanCount(),
                summary.remediationPlanCount(),
                summary.readyForReviewCount(),
                summary.sustainedPlanCount(),
                summary.dueObservationCount(),
                summary.decayedPlanCount(),
                summary.overdueControlCount(),
                summary.assessedBaselinePoints(),
                summary.currentValidatedPoints(),
                summary.totalDecayPoints(),
                summary.averagePersistencePct(),
                summary.portfolioHealth()
                        .name(),
                currentUserId
        );
    }

    public void createReviewItem(
            UUID reviewId,
            PersistencePlanResponse plan
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_outcome_persistence_review_items (
                    id,
                    review_id,
                    plan_id,
                    plan_number,
                    commitment_number,
                    initiative_number,
                    initiative_title,
                    persistence_owner_name,
                    plan_status,
                    baseline_validated_points,
                    current_validated_points,
                    persistence_pct,
                    decay_points,
                    persistence_health,
                    observation_due,
                    verification_eligible,
                    open_control_count,
                    overdue_control_count,
                    observation_count,
                    verification_count,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                reviewId,
                plan.id(),
                plan.planNumber(),
                plan.commitmentNumber(),
                plan.initiativeNumber(),
                plan.initiativeTitle(),
                plan.persistenceOwnerName(),
                plan.status()
                        .name(),
                plan.baselineValidatedContributionPoints(),
                plan.currentValidatedContributionPoints(),
                plan.persistencePct(),
                plan.decayPoints(),
                plan.persistenceHealth()
                        .name(),
                plan.observationDue(),
                plan.verificationEligible(),
                plan.openControlCount(),
                plan.overdueControlCount(),
                plan.observationCount(),
                plan.verificationCount()
        );
    }

    public ReviewRow findReview(
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        WHERE persistence_review.id = ?
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
                            persistence_review.captured_at DESC

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
                    plan_id,
                    plan_number,
                    commitment_number,
                    initiative_number,
                    initiative_title,
                    persistence_owner_name,
                    plan_status,
                    baseline_validated_points,
                    current_validated_points,
                    persistence_pct,
                    decay_points,
                    persistence_health,
                    observation_due,
                    verification_eligible,
                    open_control_count,
                    overdue_control_count,
                    observation_count,
                    verification_count

                FROM procurement_outcome_persistence_review_items

                WHERE review_id = ?

                ORDER BY
                    CASE persistence_health
                        WHEN 'REGRESSED'
                        THEN 1
                        WHEN 'DECAYING'
                        THEN 2
                        WHEN 'WATCH'
                        THEN 3
                        WHEN 'UNASSESSED'
                        THEN 4
                        ELSE 5
                    END,

                    decay_points DESC,
                    plan_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ReviewItemRow(
                                resultSet.getObject(
                                        "plan_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "plan_number"
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
                                        "persistence_owner_name"
                                ),
                                PersistencePlanStatus.valueOf(
                                        resultSet.getString(
                                                "plan_status"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_validated_points"
                                ),
                                resultSet.getBigDecimal(
                                        "current_validated_points"
                                ),
                                resultSet.getBigDecimal(
                                        "persistence_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "decay_points"
                                ),
                                PersistenceHealth.valueOf(
                                        resultSet.getString(
                                                "persistence_health"
                                        )
                                ),
                                resultSet.getBoolean(
                                        "observation_due"
                                ),
                                resultSet.getBoolean(
                                        "verification_eligible"
                                ),
                                resultSet.getInt(
                                        "open_control_count"
                                ),
                                resultSet.getInt(
                                        "overdue_control_count"
                                ),
                                resultSet.getInt(
                                        "observation_count"
                                ),
                                resultSet.getInt(
                                        "verification_count"
                                )
                        ),
                reviewId
        );
    }

    private String planSql() {
        return """
                SELECT
                    persistence_plan.id,
                    persistence_plan.plan_number,
                    persistence_plan.commitment_id,
                    persistence_plan.commitment_number,
                    persistence_plan.roadmap_id,
                    persistence_plan.roadmap_number,
                    persistence_plan.initiative_number,
                    persistence_plan.initiative_title,
                    persistence_plan.execution_owner_name,
                    persistence_plan.persistence_owner_user_id,
                    persistence_plan.persistence_owner_name_snapshot,
                    persistence_plan.currency,
                    persistence_plan.fiscal_year,
                    persistence_plan.baseline_validated_contribution_points,
                    persistence_plan.observation_start_date,
                    persistence_plan.observation_end_date,
                    persistence_plan.minimum_persistence_pct,
                    persistence_plan.persistence_objective,
                    persistence_plan.status,
                    persistence_plan.close_note,

                    closer.full_name
                        AS closed_by_name,

                    persistence_plan.closed_at,
                    persistence_plan.created_at,
                    persistence_plan.updated_at,
                    persistence_plan.version

                FROM procurement_outcome_persistence_plans
                    persistence_plan

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       persistence_plan.closed_by_user_id

                """;
    }

    private String observationSql() {
        return """
                SELECT
                    observation.id,
                    observation.plan_id,
                    observation.observed_on,
                    observation.reported_contribution_points,
                    observation.evidence_note,

                    reporter.full_name
                        AS reported_by_name,

                    observation.reported_at

                FROM procurement_outcome_persistence_observations
                    observation

                JOIN app_users
                    reporter
                    ON reporter.id =
                       observation.reported_by_user_id

                """;
    }

    private String validationSql() {
        return """
                SELECT
                    validation.id,
                    validation.observation_id,
                    validation.decision,
                    validation.validated_contribution_points,
                    validation.validation_note,

                    validator.full_name
                        AS validated_by_name,

                    validation.validated_at

                FROM procurement_outcome_persistence_validations
                    validation

                JOIN app_users
                    validator
                    ON validator.id =
                       validation.validated_by_user_id

                """;
    }

    private String controlSql() {
        return """
                SELECT
                    persistence_control.id,
                    persistence_control.plan_id,
                    persistence_control.title,
                    persistence_control.description,
                    persistence_control.owner_user_id,
                    persistence_control.owner_name_snapshot,
                    persistence_control.due_date,
                    persistence_control.status,
                    persistence_control.completion_evidence,
                    persistence_control.started_at,
                    persistence_control.completed_at,
                    persistence_control.cancelled_at,
                    persistence_control.created_at,
                    persistence_control.updated_at,
                    persistence_control.version

                FROM procurement_outcome_persistence_controls
                    persistence_control

                """;
    }

    private String verificationSql() {
        return """
                SELECT
                    verification.id,
                    verification.plan_id,
                    verification.decision,
                    verification.persistence_pct,
                    verification.decay_points,
                    verification.persistence_health,
                    verification.verification_note,

                    verifier.full_name
                        AS verified_by_name,

                    verification.verified_at

                FROM procurement_outcome_persistence_verifications
                    verification

                JOIN app_users
                    verifier
                    ON verifier.id =
                       verification.verified_by_user_id

                """;
    }

    private String reviewSql() {
        return """
                SELECT
                    persistence_review.id,
                    persistence_review.review_number,
                    persistence_review.active_plan_count,
                    persistence_review.remediation_plan_count,
                    persistence_review.ready_for_review_count,
                    persistence_review.sustained_plan_count,
                    persistence_review.due_observation_count,
                    persistence_review.decayed_plan_count,
                    persistence_review.overdue_control_count,
                    persistence_review.assessed_baseline_points,
                    persistence_review.current_validated_points,
                    persistence_review.total_decay_points,
                    persistence_review.average_persistence_pct,
                    persistence_review.portfolio_health,

                    user_account.full_name
                        AS captured_by_name,

                    persistence_review.captured_at

                FROM procurement_outcome_persistence_reviews
                    persistence_review

                JOIN app_users
                    user_account
                    ON user_account.id =
                       persistence_review.captured_by_user_id

                """;
    }

    private PlanRow mapPlan(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new PlanRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "plan_number"
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
                        "persistence_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "persistence_owner_name_snapshot"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "baseline_validated_contribution_points"
                ),
                resultSet.getObject(
                        "observation_start_date",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "observation_end_date",
                        LocalDate.class
                ),
                resultSet.getBigDecimal(
                        "minimum_persistence_pct"
                ),
                resultSet.getString(
                        "persistence_objective"
                ),
                PersistencePlanStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
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

    private ObservationRow mapObservation(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ObservationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "plan_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "observed_on",
                        LocalDate.class
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
                        "observation_id",
                        UUID.class
                ),
                PersistenceValidationDecision.valueOf(
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

    private ControlRow mapControl(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ControlRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "plan_id",
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
                PersistenceControlStatus.valueOf(
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

    private VerificationRow mapVerification(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new VerificationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "plan_id",
                        UUID.class
                ),
                PersistenceVerificationDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),
                resultSet.getBigDecimal(
                        "persistence_pct"
                ),
                resultSet.getBigDecimal(
                        "decay_points"
                ),
                PersistenceHealth.valueOf(
                        resultSet.getString(
                                "persistence_health"
                        )
                ),
                resultSet.getString(
                        "verification_note"
                ),
                resultSet.getString(
                        "verified_by_name"
                ),
                resultSet.getTimestamp(
                        "verified_at"
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
                        "active_plan_count"
                ),
                resultSet.getInt(
                        "remediation_plan_count"
                ),
                resultSet.getInt(
                        "ready_for_review_count"
                ),
                resultSet.getInt(
                        "sustained_plan_count"
                ),
                resultSet.getInt(
                        "due_observation_count"
                ),
                resultSet.getInt(
                        "decayed_plan_count"
                ),
                resultSet.getInt(
                        "overdue_control_count"
                ),
                resultSet.getBigDecimal(
                        "assessed_baseline_points"
                ),
                resultSet.getBigDecimal(
                        "current_validated_points"
                ),
                resultSet.getBigDecimal(
                        "total_decay_points"
                ),
                resultSet.getBigDecimal(
                        "average_persistence_pct"
                ),
                PersistenceHealth.valueOf(
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

    public record PlanRow(
            UUID id,
            String planNumber,
            UUID commitmentId,
            String commitmentNumber,
            UUID roadmapId,
            String roadmapNumber,
            String initiativeNumber,
            String initiativeTitle,
            String executionOwnerName,
            UUID persistenceOwnerUserId,
            String persistenceOwnerName,
            String currency,
            int fiscalYear,
            BigDecimal baselineValidatedContributionPoints,
            LocalDate observationStartDate,
            LocalDate observationEndDate,
            BigDecimal minimumPersistencePct,
            String persistenceObjective,
            PersistencePlanStatus status,
            String closeNote,
            String closedByName,
            Instant closedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ObservationRow(
            UUID id,
            UUID planId,
            LocalDate observedOn,
            BigDecimal reportedContributionPoints,
            String evidenceNote,
            String reportedByName,
            Instant reportedAt
    ) {
    }

    public record ValidatedObservationRow(
            UUID observationId,
            LocalDate observedOn,
            BigDecimal validatedContributionPoints,
            Instant validatedAt
    ) {
    }

    public record ValidationRow(
            UUID id,
            UUID observationId,
            PersistenceValidationDecision decision,
            BigDecimal validatedContributionPoints,
            String validationNote,
            String validatedByName,
            Instant validatedAt
    ) {
    }

    public record ControlRow(
            UUID id,
            UUID planId,
            String title,
            String description,
            UUID ownerUserId,
            String ownerName,
            LocalDate dueDate,
            PersistenceControlStatus status,
            String completionEvidence,
            Instant startedAt,
            Instant completedAt,
            Instant cancelledAt,
            Instant createdAt,
            long version
    ) {
    }

    public record VerificationRow(
            UUID id,
            UUID planId,
            PersistenceVerificationDecision decision,
            BigDecimal persistencePct,
            BigDecimal decayPoints,
            PersistenceHealth persistenceHealth,
            String verificationNote,
            String verifiedByName,
            Instant verifiedAt
    ) {
    }

    public record ReviewRow(
            UUID id,
            String reviewNumber,
            int activePlanCount,
            int remediationPlanCount,
            int readyForReviewCount,
            int sustainedPlanCount,
            int dueObservationCount,
            int decayedPlanCount,
            int overdueControlCount,
            BigDecimal assessedBaselinePoints,
            BigDecimal currentValidatedPoints,
            BigDecimal totalDecayPoints,
            BigDecimal averagePersistencePct,
            PersistenceHealth portfolioHealth,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record ReviewItemRow(
            UUID planId,
            String planNumber,
            String commitmentNumber,
            String initiativeNumber,
            String initiativeTitle,
            String persistenceOwnerName,
            PersistencePlanStatus planStatus,
            BigDecimal baselineValidatedPoints,
            BigDecimal currentValidatedPoints,
            BigDecimal persistencePct,
            BigDecimal decayPoints,
            PersistenceHealth persistenceHealth,
            boolean observationDue,
            boolean verificationEligible,
            int openControlCount,
            int overdueControlCount,
            int observationCount,
            int verificationCount
    ) {
    }
}
