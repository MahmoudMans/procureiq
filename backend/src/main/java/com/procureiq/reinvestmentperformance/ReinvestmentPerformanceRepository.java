package com.procureiq.reinvestmentperformance;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class ReinvestmentPerformanceRepository {

    private final JdbcTemplate jdbcTemplate;

    public ReinvestmentPerformanceRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCaseSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_reinvestment_performance_case_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_reinvestment_performance_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<ReinvestmentPerformanceUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role

                FROM app_users

                WHERE active = TRUE
                AND role <> 'REQUESTER'

                ORDER BY
                    full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ReinvestmentPerformanceUserOptionResponse(
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
            String caseNumber,
            ReinvestmentPerformanceCandidateResponse candidate,
            ReinvestmentPerformanceCaseInput input,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_performance_cases (
                    id,
                    performance_case_number,
                    redeployment_case_id,
                    redeployment_number,
                    recycling_source_id,
                    recycling_source_number,
                    target_value_case_id,
                    target_value_case_number,
                    target_initiative_number,
                    target_initiative_title,
                    currency,
                    fiscal_year,
                    redeployed_capital_amount,
                    baseline_target_roi_pct,
                    baseline_target_persistence_pct,
                    baseline_target_net_value_amount,
                    measurement_horizon_months,
                    annual_operating_cost_amount,
                    performance_owner_user_id,
                    performance_owner_name_snapshot,
                    performance_objective,
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
                    'ACTIVE',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                caseId,
                caseNumber,
                candidate.redeploymentCaseId(),
                candidate.redeploymentNumber(),
                candidate.recyclingSourceId(),
                candidate.recyclingSourceNumber(),
                candidate.targetValueCaseId(),
                candidate.targetValueCaseNumber(),
                candidate.targetInitiativeNumber(),
                candidate.targetInitiativeTitle(),
                candidate.currency(),
                candidate.fiscalYear(),
                candidate.redeployedCapitalAmount(),
                candidate.baselineTargetRoiPct(),
                candidate.baselineTargetPersistencePct(),
                candidate.baselineTargetNetValueAmount(),
                input.measurementHorizonMonths(),
                input.annualOperatingCostAmount(),
                input.performanceOwnerUserId(),
                ownerName,
                input.performanceObjective()
                        .trim(),
                currentUserId
        );
    }

    public CaseRow activeCaseForRedeployment(
            UUID redeploymentCaseId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE performance_case.redeployment_case_id = ?
                        AND performance_case.status <> 'CLOSED'

                        ORDER BY
                            performance_case.created_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        ),
                redeploymentCaseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public CaseRow findCase(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE performance_case.id = ?
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
                            CASE performance_case.status
                                WHEN 'READY_FOR_REVIEW'
                                THEN 1
                                WHEN 'REMEDIATION_REQUIRED'
                                THEN 2
                                WHEN 'ACTIVE'
                                THEN 3
                                WHEN 'VERIFIED'
                                THEN 4
                                ELSE 5
                            END,

                            performance_case.created_at DESC
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

    public void createObservation(
            UUID observationId,
            UUID caseId,
            ReinvestmentPerformanceObservationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_performance_observations (
                    id,
                    performance_case_id,
                    observed_on,
                    reported_realized_annualized_value_amount,
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
                caseId,
                input.observedOn(),
                input.reportedRealizedAnnualizedValueAmount(),
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
                        WHERE performance_observation.id = ?
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
            UUID caseId
    ) {
        return jdbcTemplate.query(
                observationSql()
                        + """
                        WHERE performance_observation.performance_case_id = ?

                        ORDER BY
                            performance_observation.observed_on DESC,
                            performance_observation.reported_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapObservation(
                                resultSet
                        ),
                caseId
        );
    }

    public ValidationRow validation(
            UUID observationId
    ) {
        return jdbcTemplate.query(
                validationSql()
                        + """
                        WHERE performance_validation.observation_id = ?
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
            ReinvestmentPerformanceValidationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_performance_validations (
                    id,
                    observation_id,
                    decision,
                    validated_realized_annualized_value_amount,
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
                        == ReinvestmentPerformanceValidationDecision.VALIDATED
                        ? input.validatedRealizedAnnualizedValueAmount()
                        : null,
                input.validationNote()
                        .trim(),
                currentUserId
        );
    }

    public AssessedObservationRow latestValidatedObservation(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    performance_observation.id
                        AS observation_id,

                    performance_observation.observed_on,

                    performance_validation.validated_realized_annualized_value_amount,
                    performance_validation.validated_at

                FROM procurement_reinvestment_performance_observations
                    performance_observation

                JOIN procurement_reinvestment_performance_validations
                    performance_validation
                    ON performance_validation.observation_id =
                       performance_observation.id

                WHERE performance_observation.performance_case_id = ?
                AND performance_validation.decision = 'VALIDATED'

                ORDER BY
                    performance_observation.observed_on DESC,
                    performance_validation.validated_at DESC

                LIMIT 1
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new AssessedObservationRow(
                                resultSet.getObject(
                                        "observation_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "observed_on",
                                        LocalDate.class
                                ),
                                resultSet.getBigDecimal(
                                        "validated_realized_annualized_value_amount"
                                ),
                                resultSet.getTimestamp(
                                        "validated_at"
                                )
                                        .toInstant()
                        ),
                caseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void markReadyForReview(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_reinvestment_performance_cases

                SET
                    status = 'READY_FOR_REVIEW',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status IN (
                    'ACTIVE',
                    'REMEDIATION_REQUIRED'
                )
                """,
                caseId
        );
    }

    public void createReview(
            UUID reviewId,
            UUID caseId,
            UUID observationId,
            ReinvestmentPerformanceReviewInput input,
            ReinvestmentPerformanceMetricResult metric,
            BigDecimal validatedAnnualizedValue,
            BigDecimal baselineTargetRoiPct,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_performance_reviews (
                    id,
                    performance_case_id,
                    observation_id,
                    decision,
                    health,
                    redeployed_capital_amount,
                    operating_cost_horizon_amount,
                    total_cost_amount,
                    expected_horizon_value_amount,
                    validated_realized_annualized_value_amount,
                    realized_horizon_value_amount,
                    realized_net_value_amount,
                    baseline_target_roi_pct,
                    realized_roi_pct,
                    roi_variance_pct,
                    value_variance_amount,
                    realization_pct,
                    review_note,
                    reviewed_by_user_id,
                    reviewed_at
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
                    CURRENT_TIMESTAMP
                )
                """,
                reviewId,
                caseId,
                observationId,
                input.decision()
                        .name(),
                metric.health()
                        .name(),
                metric.redeployedCapitalAmount(),
                metric.operatingCostHorizonAmount(),
                metric.totalCostAmount(),
                metric.expectedHorizonValueAmount(),
                validatedAnnualizedValue,
                metric.realizedHorizonValueAmount(),
                metric.realizedNetValueAmount(),
                baselineTargetRoiPct,
                metric.realizedRoiPct(),
                metric.roiVariancePct(),
                metric.valueVarianceAmount(),
                metric.realizationPct(),
                input.reviewNote()
                        .trim(),
                currentUserId
        );
    }

    public List<ReviewRow> reviews(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        WHERE performance_review.performance_case_id = ?

                        ORDER BY
                            performance_review.reviewed_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapReview(
                                resultSet
                        ),
                caseId
        );
    }

    public void markVerified(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_reinvestment_performance_cases

                SET
                    status = 'VERIFIED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_REVIEW'
                """,
                caseId
        );
    }

    public void markRemediationRequired(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_reinvestment_performance_cases

                SET
                    status = 'REMEDIATION_REQUIRED',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_REVIEW'
                """,
                caseId
        );
    }

    public void closeCase(
            UUID caseId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_reinvestment_performance_cases

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
                note.trim(),
                currentUserId,
                caseId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            ReinvestmentPerformanceSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_performance_snapshots (
                    id,
                    snapshot_number,
                    case_count,
                    assessed_case_count,
                    outperforming_case_count,
                    on_track_case_count,
                    watch_case_count,
                    underperforming_case_count,
                    remediation_case_count,
                    average_realized_roi_pct,
                    average_roi_variance_pct,
                    average_realization_pct,
                    total_redeployed_capital_amount,
                    total_realized_net_value_amount,
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
                snapshotId,
                snapshotNumber,
                summary.caseCount(),
                summary.assessedCaseCount(),
                summary.outperformingCaseCount(),
                summary.onTrackCaseCount(),
                summary.watchCaseCount(),
                summary.underperformingCaseCount(),
                summary.remediationCaseCount(),
                summary.averageRealizedRoiPct(),
                summary.averageRoiVariancePct(),
                summary.averageRealizationPct(),
                summary.totalRedeployedCapitalAmount(),
                summary.totalRealizedNetValueAmount(),
                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            ReinvestmentPerformanceCaseResponse performanceCase
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_performance_snapshot_items (
                    id,
                    snapshot_id,
                    performance_case_id,
                    performance_case_number,
                    redeployment_number,
                    target_value_case_number,
                    target_initiative_title,
                    currency,
                    case_status,
                    assessed,
                    redeployed_capital_amount,
                    expected_horizon_value_amount,
                    validated_realized_annualized_value_amount,
                    realized_horizon_value_amount,
                    realized_net_value_amount,
                    baseline_target_roi_pct,
                    realized_roi_pct,
                    roi_variance_pct,
                    value_variance_amount,
                    realization_pct,
                    health,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,
                performanceCase.id(),
                performanceCase.performanceCaseNumber(),
                performanceCase.redeploymentNumber(),
                performanceCase.targetValueCaseNumber(),
                performanceCase.targetInitiativeTitle(),
                performanceCase.currency(),
                performanceCase.status()
                        .name(),
                performanceCase.assessed(),
                performanceCase.redeployedCapitalAmount(),
                performanceCase.expectedHorizonValueAmount(),
                performanceCase.validatedRealizedAnnualizedValueAmount(),
                performanceCase.realizedHorizonValueAmount(),
                performanceCase.realizedNetValueAmount(),
                performanceCase.baselineTargetRoiPct(),
                performanceCase.realizedRoiPct(),
                performanceCase.roiVariancePct(),
                performanceCase.valueVarianceAmount(),
                performanceCase.realizationPct(),
                performanceCase.health()
                        .name()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE performance_snapshot.id = ?
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
                            performance_snapshot.captured_at DESC

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

    public List<SnapshotItemRow> snapshotItems(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    performance_case_id,
                    performance_case_number,
                    redeployment_number,
                    target_value_case_number,
                    target_initiative_title,
                    currency,
                    case_status,
                    assessed,
                    redeployed_capital_amount,
                    expected_horizon_value_amount,
                    validated_realized_annualized_value_amount,
                    realized_horizon_value_amount,
                    realized_net_value_amount,
                    baseline_target_roi_pct,
                    realized_roi_pct,
                    roi_variance_pct,
                    value_variance_amount,
                    realization_pct,
                    health

                FROM procurement_reinvestment_performance_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    CASE health
                        WHEN 'UNDERPERFORMING'
                        THEN 1
                        WHEN 'WATCH'
                        THEN 2
                        WHEN 'ON_TRACK'
                        THEN 3
                        WHEN 'OUTPERFORMING'
                        THEN 4
                        ELSE 5
                    END,

                    realization_pct,
                    performance_case_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "performance_case_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "performance_case_number"
                                ),
                                resultSet.getString(
                                        "redeployment_number"
                                ),
                                resultSet.getString(
                                        "target_value_case_number"
                                ),
                                resultSet.getString(
                                        "target_initiative_title"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                ReinvestmentPerformanceStatus.valueOf(
                                        resultSet.getString(
                                                "case_status"
                                        )
                                ),
                                resultSet.getBoolean(
                                        "assessed"
                                ),
                                resultSet.getBigDecimal(
                                        "redeployed_capital_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "expected_horizon_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "validated_realized_annualized_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "realized_horizon_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "realized_net_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_target_roi_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "realized_roi_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "roi_variance_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "value_variance_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "realization_pct"
                                ),
                                ReinvestmentPerformanceHealth.valueOf(
                                        resultSet.getString(
                                                "health"
                                        )
                                )
                        ),
                snapshotId
        );
    }

    private String caseSql() {
        return """
                SELECT
                    performance_case.id,
                    performance_case.performance_case_number,
                    performance_case.redeployment_case_id,
                    performance_case.redeployment_number,
                    performance_case.recycling_source_id,
                    performance_case.recycling_source_number,
                    performance_case.target_value_case_id,
                    performance_case.target_value_case_number,
                    performance_case.target_initiative_number,
                    performance_case.target_initiative_title,
                    performance_case.currency,
                    performance_case.fiscal_year,
                    performance_case.redeployed_capital_amount,
                    performance_case.baseline_target_roi_pct,
                    performance_case.baseline_target_persistence_pct,
                    performance_case.baseline_target_net_value_amount,
                    performance_case.measurement_horizon_months,
                    performance_case.annual_operating_cost_amount,
                    performance_case.performance_owner_user_id,
                    performance_case.performance_owner_name_snapshot,
                    performance_case.performance_objective,
                    performance_case.status,
                    performance_case.close_note,

                    closer.full_name
                        AS closed_by_name,

                    performance_case.closed_at,
                    performance_case.created_at,
                    performance_case.updated_at,
                    performance_case.version

                FROM procurement_reinvestment_performance_cases
                    performance_case

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       performance_case.closed_by_user_id

                """;
    }

    private String observationSql() {
        return """
                SELECT
                    performance_observation.id,
                    performance_observation.performance_case_id,
                    performance_observation.observed_on,
                    performance_observation.reported_realized_annualized_value_amount,
                    performance_observation.evidence_note,

                    reporter.full_name
                        AS reported_by_name,

                    performance_observation.reported_at

                FROM procurement_reinvestment_performance_observations
                    performance_observation

                JOIN app_users
                    reporter
                    ON reporter.id =
                       performance_observation.reported_by_user_id

                """;
    }

    private String validationSql() {
        return """
                SELECT
                    performance_validation.id,
                    performance_validation.observation_id,
                    performance_validation.decision,
                    performance_validation.validated_realized_annualized_value_amount,
                    performance_validation.validation_note,

                    validator.full_name
                        AS validated_by_name,

                    performance_validation.validated_at

                FROM procurement_reinvestment_performance_validations
                    performance_validation

                JOIN app_users
                    validator
                    ON validator.id =
                       performance_validation.validated_by_user_id

                """;
    }

    private String reviewSql() {
        return """
                SELECT
                    performance_review.id,
                    performance_review.performance_case_id,
                    performance_review.observation_id,
                    performance_review.decision,
                    performance_review.health,
                    performance_review.redeployed_capital_amount,
                    performance_review.operating_cost_horizon_amount,
                    performance_review.total_cost_amount,
                    performance_review.expected_horizon_value_amount,
                    performance_review.validated_realized_annualized_value_amount,
                    performance_review.realized_horizon_value_amount,
                    performance_review.realized_net_value_amount,
                    performance_review.baseline_target_roi_pct,
                    performance_review.realized_roi_pct,
                    performance_review.roi_variance_pct,
                    performance_review.value_variance_amount,
                    performance_review.realization_pct,
                    performance_review.review_note,

                    reviewer.full_name
                        AS reviewed_by_name,

                    performance_review.reviewed_at

                FROM procurement_reinvestment_performance_reviews
                    performance_review

                JOIN app_users
                    reviewer
                    ON reviewer.id =
                       performance_review.reviewed_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    performance_snapshot.id,
                    performance_snapshot.snapshot_number,
                    performance_snapshot.case_count,
                    performance_snapshot.assessed_case_count,
                    performance_snapshot.outperforming_case_count,
                    performance_snapshot.on_track_case_count,
                    performance_snapshot.watch_case_count,
                    performance_snapshot.underperforming_case_count,
                    performance_snapshot.remediation_case_count,
                    performance_snapshot.average_realized_roi_pct,
                    performance_snapshot.average_roi_variance_pct,
                    performance_snapshot.average_realization_pct,
                    performance_snapshot.total_redeployed_capital_amount,
                    performance_snapshot.total_realized_net_value_amount,

                    user_account.full_name
                        AS captured_by_name,

                    performance_snapshot.captured_at

                FROM procurement_reinvestment_performance_snapshots
                    performance_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       performance_snapshot.captured_by_user_id

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
                        "performance_case_number"
                ),
                resultSet.getObject(
                        "redeployment_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "redeployment_number"
                ),
                resultSet.getObject(
                        "recycling_source_id",
                        UUID.class
                ),
                resultSet.getString(
                        "recycling_source_number"
                ),
                resultSet.getObject(
                        "target_value_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "target_value_case_number"
                ),
                resultSet.getString(
                        "target_initiative_number"
                ),
                resultSet.getString(
                        "target_initiative_title"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "redeployed_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "baseline_target_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "baseline_target_persistence_pct"
                ),
                resultSet.getBigDecimal(
                        "baseline_target_net_value_amount"
                ),
                resultSet.getInt(
                        "measurement_horizon_months"
                ),
                resultSet.getBigDecimal(
                        "annual_operating_cost_amount"
                ),
                resultSet.getObject(
                        "performance_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "performance_owner_name_snapshot"
                ),
                resultSet.getString(
                        "performance_objective"
                ),
                ReinvestmentPerformanceStatus.valueOf(
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
                        "performance_case_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "observed_on",
                        LocalDate.class
                ),
                resultSet.getBigDecimal(
                        "reported_realized_annualized_value_amount"
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
                ReinvestmentPerformanceValidationDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),
                resultSet.getBigDecimal(
                        "validated_realized_annualized_value_amount"
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
                resultSet.getObject(
                        "performance_case_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "observation_id",
                        UUID.class
                ),
                ReinvestmentPerformanceReviewDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),
                ReinvestmentPerformanceHealth.valueOf(
                        resultSet.getString(
                                "health"
                        )
                ),
                resultSet.getBigDecimal(
                        "redeployed_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "operating_cost_horizon_amount"
                ),
                resultSet.getBigDecimal(
                        "total_cost_amount"
                ),
                resultSet.getBigDecimal(
                        "expected_horizon_value_amount"
                ),
                resultSet.getBigDecimal(
                        "validated_realized_annualized_value_amount"
                ),
                resultSet.getBigDecimal(
                        "realized_horizon_value_amount"
                ),
                resultSet.getBigDecimal(
                        "realized_net_value_amount"
                ),
                resultSet.getBigDecimal(
                        "baseline_target_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "realized_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "roi_variance_pct"
                ),
                resultSet.getBigDecimal(
                        "value_variance_amount"
                ),
                resultSet.getBigDecimal(
                        "realization_pct"
                ),
                resultSet.getString(
                        "review_note"
                ),
                resultSet.getString(
                        "reviewed_by_name"
                ),
                resultSet.getTimestamp(
                        "reviewed_at"
                )
                        .toInstant()
        );
    }

    private SnapshotRow mapSnapshot(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new SnapshotRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "snapshot_number"
                ),
                resultSet.getInt(
                        "case_count"
                ),
                resultSet.getInt(
                        "assessed_case_count"
                ),
                resultSet.getInt(
                        "outperforming_case_count"
                ),
                resultSet.getInt(
                        "on_track_case_count"
                ),
                resultSet.getInt(
                        "watch_case_count"
                ),
                resultSet.getInt(
                        "underperforming_case_count"
                ),
                resultSet.getInt(
                        "remediation_case_count"
                ),
                resultSet.getBigDecimal(
                        "average_realized_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "average_roi_variance_pct"
                ),
                resultSet.getBigDecimal(
                        "average_realization_pct"
                ),
                resultSet.getBigDecimal(
                        "total_redeployed_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "total_realized_net_value_amount"
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

    public record CaseRow(
            UUID id,
            String performanceCaseNumber,

            UUID redeploymentCaseId,
            String redeploymentNumber,

            UUID recyclingSourceId,
            String recyclingSourceNumber,

            UUID targetValueCaseId,
            String targetValueCaseNumber,
            String targetInitiativeNumber,
            String targetInitiativeTitle,

            String currency,
            int fiscalYear,

            BigDecimal redeployedCapitalAmount,
            BigDecimal baselineTargetRoiPct,
            BigDecimal baselineTargetPersistencePct,
            BigDecimal baselineTargetNetValueAmount,

            int measurementHorizonMonths,
            BigDecimal annualOperatingCostAmount,

            UUID performanceOwnerUserId,
            String performanceOwnerName,
            String performanceObjective,

            ReinvestmentPerformanceStatus status,

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
            UUID performanceCaseId,
            LocalDate observedOn,
            BigDecimal reportedRealizedAnnualizedValueAmount,
            String evidenceNote,
            String reportedByName,
            Instant reportedAt
    ) {
    }

    public record ValidationRow(
            UUID id,
            UUID observationId,
            ReinvestmentPerformanceValidationDecision decision,
            BigDecimal validatedRealizedAnnualizedValueAmount,
            String validationNote,
            String validatedByName,
            Instant validatedAt
    ) {
    }

    public record AssessedObservationRow(
            UUID observationId,
            LocalDate observedOn,
            BigDecimal validatedRealizedAnnualizedValueAmount,
            Instant validatedAt
    ) {
    }

    public record ReviewRow(
            UUID id,
            UUID performanceCaseId,
            UUID observationId,

            ReinvestmentPerformanceReviewDecision decision,
            ReinvestmentPerformanceHealth health,

            BigDecimal redeployedCapitalAmount,
            BigDecimal operatingCostHorizonAmount,
            BigDecimal totalCostAmount,
            BigDecimal expectedHorizonValueAmount,

            BigDecimal validatedRealizedAnnualizedValueAmount,
            BigDecimal realizedHorizonValueAmount,
            BigDecimal realizedNetValueAmount,

            BigDecimal baselineTargetRoiPct,
            BigDecimal realizedRoiPct,
            BigDecimal roiVariancePct,

            BigDecimal valueVarianceAmount,
            BigDecimal realizationPct,

            String reviewNote,
            String reviewedByName,
            Instant reviewedAt
    ) {
    }

    public record SnapshotRow(
            UUID id,
            String snapshotNumber,

            int caseCount,
            int assessedCaseCount,
            int outperformingCaseCount,
            int onTrackCaseCount,
            int watchCaseCount,
            int underperformingCaseCount,
            int remediationCaseCount,

            BigDecimal averageRealizedRoiPct,
            BigDecimal averageRoiVariancePct,
            BigDecimal averageRealizationPct,

            BigDecimal totalRedeployedCapitalAmount,
            BigDecimal totalRealizedNetValueAmount,

            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID performanceCaseId,
            String performanceCaseNumber,
            String redeploymentNumber,
            String targetValueCaseNumber,
            String targetInitiativeTitle,
            String currency,

            ReinvestmentPerformanceStatus caseStatus,
            boolean assessed,

            BigDecimal redeployedCapitalAmount,
            BigDecimal expectedHorizonValueAmount,
            BigDecimal validatedRealizedAnnualizedValueAmount,
            BigDecimal realizedHorizonValueAmount,
            BigDecimal realizedNetValueAmount,

            BigDecimal baselineTargetRoiPct,
            BigDecimal realizedRoiPct,
            BigDecimal roiVariancePct,
            BigDecimal valueVarianceAmount,
            BigDecimal realizationPct,

            ReinvestmentPerformanceHealth health
    ) {
    }
}
