package com.procureiq.reinvestmentpersistence;

import com.procureiq.reinvestmentperformance.ReinvestmentPerformanceHealth;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class ReinvestmentPersistenceRepository {

    private final JdbcTemplate jdbcTemplate;

    public ReinvestmentPersistenceRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCaseSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_reinvestment_persistence_case_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_reinvestment_persistence_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<ReinvestmentPersistenceUserOptionResponse> users() {
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
                        new ReinvestmentPersistenceUserOptionResponse(
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
            ReinvestmentPersistenceCandidateResponse candidate,
            ReinvestmentPersistenceCaseInput input,
            String ownerName,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_persistence_cases (
                    id,
                    persistence_case_number,
                    source_performance_case_id,
                    source_performance_case_number,
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
                    baseline_validated_annualized_value_amount,
                    baseline_realized_horizon_value_amount,
                    baseline_realized_net_value_amount,
                    baseline_total_cost_amount,
                    baseline_realized_roi_pct,
                    baseline_realization_pct,
                    baseline_performance_health,
                    measurement_horizon_months,
                    persistence_observation_window_months,
                    minimum_value_persistence_pct,
                    minimum_efficiency_retention_pct,
                    persistence_owner_user_id,
                    persistence_owner_name_snapshot,
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

                candidate.sourcePerformanceCaseId(),
                candidate.sourcePerformanceCaseNumber(),

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

                candidate.baselineValidatedAnnualizedValueAmount(),
                candidate.baselineRealizedHorizonValueAmount(),
                candidate.baselineRealizedNetValueAmount(),
                candidate.baselineTotalCostAmount(),

                candidate.baselineRealizedRoiPct(),
                candidate.baselineRealizationPct(),

                candidate.baselinePerformanceHealth()
                        .name(),

                candidate.measurementHorizonMonths(),

                input.persistenceObservationWindowMonths(),
                input.minimumValuePersistencePct(),
                input.minimumEfficiencyRetentionPct(),

                input.persistenceOwnerUserId(),
                ownerName,

                input.persistenceObjective()
                        .trim(),

                currentUserId
        );
    }

    public CaseRow activeCaseForPerformance(
            UUID sourcePerformanceCaseId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE persistence_case.source_performance_case_id = ?
                        AND persistence_case.status <> 'CLOSED'

                        ORDER BY
                            persistence_case.created_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        ),
                sourcePerformanceCaseId
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
                        WHERE persistence_case.id = ?
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
                            CASE persistence_case.status
                                WHEN 'READY_FOR_REVIEW'
                                THEN 1
                                WHEN 'REMEDIATION_REQUIRED'
                                THEN 2
                                WHEN 'ACTIVE'
                                THEN 3
                                WHEN 'SUSTAINED'
                                THEN 4
                                ELSE 5
                            END,
                            persistence_case.created_at DESC
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
            ReinvestmentPersistenceObservationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_persistence_observations (
                    id,
                    persistence_case_id,
                    observed_on,
                    reported_current_annualized_value_amount,
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
                input.reportedCurrentAnnualizedValueAmount(),
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
                        WHERE persistence_observation.id = ?
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
                        WHERE persistence_observation.persistence_case_id = ?

                        ORDER BY
                            persistence_observation.observed_on DESC,
                            persistence_observation.reported_at DESC
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
                        WHERE persistence_validation.observation_id = ?
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
            ReinvestmentPersistenceValidationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_persistence_validations (
                    id,
                    observation_id,
                    decision,
                    validated_current_annualized_value_amount,
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
                        == ReinvestmentPersistenceValidationDecision.VALIDATED
                        ? input.validatedCurrentAnnualizedValueAmount()
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
                    persistence_observation.id
                        AS observation_id,

                    persistence_observation.observed_on,

                    persistence_validation.validated_current_annualized_value_amount,

                    persistence_validation.validated_at

                FROM procurement_reinvestment_persistence_observations
                    persistence_observation

                JOIN procurement_reinvestment_persistence_validations
                    persistence_validation
                    ON persistence_validation.observation_id =
                       persistence_observation.id

                WHERE persistence_observation.persistence_case_id = ?
                AND persistence_validation.decision = 'VALIDATED'

                ORDER BY
                    persistence_observation.observed_on DESC,
                    persistence_validation.validated_at DESC

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
                                        "validated_current_annualized_value_amount"
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
                UPDATE procurement_reinvestment_persistence_cases

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
            ReinvestmentPersistenceReviewInput input,
            ReinvestmentPersistenceMetricResult metric,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_persistence_reviews (
                    id,
                    persistence_case_id,
                    observation_id,
                    decision,
                    health,
                    baseline_validated_annualized_value_amount,
                    current_validated_annualized_value_amount,
                    baseline_realized_horizon_value_amount,
                    current_projected_horizon_value_amount,
                    baseline_realized_net_value_amount,
                    current_projected_net_value_amount,
                    baseline_realized_roi_pct,
                    current_projected_roi_pct,
                    roi_variance_pct,
                    value_persistence_pct,
                    compounding_value_amount,
                    decayed_value_amount,
                    baseline_capital_efficiency_multiple,
                    current_capital_efficiency_multiple,
                    capital_efficiency_delta,
                    efficiency_retention_pct,
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

                metric.baselineAnnualizedValueAmount(),
                metric.currentAnnualizedValueAmount(),

                metric.baselineHorizonValueAmount(),
                metric.currentProjectedHorizonValueAmount(),

                metric.baselineNetValueAmount(),
                metric.currentProjectedNetValueAmount(),

                metric.baselineRoiPct(),
                metric.currentProjectedRoiPct(),
                metric.roiVariancePct(),

                metric.valuePersistencePct(),
                metric.compoundingValueAmount(),
                metric.decayedValueAmount(),

                metric.baselineCapitalEfficiencyMultiple(),
                metric.currentCapitalEfficiencyMultiple(),
                metric.capitalEfficiencyDelta(),
                metric.efficiencyRetentionPct(),

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
                        WHERE persistence_review.persistence_case_id = ?

                        ORDER BY
                            persistence_review.reviewed_at DESC
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

    public void markSustained(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_reinvestment_persistence_cases

                SET
                    status = 'SUSTAINED',
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
                UPDATE procurement_reinvestment_persistence_cases

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
                UPDATE procurement_reinvestment_persistence_cases

                SET
                    status = 'CLOSED',
                    close_note = ?,
                    closed_by_user_id = ?,
                    closed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'SUSTAINED'
                """,
                note.trim(),
                currentUserId,
                caseId
        );
    }

    public void createSnapshot(
            UUID snapshotId,
            String snapshotNumber,
            ReinvestmentPersistenceSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_persistence_snapshots (
                    id,
                    snapshot_number,
                    case_count,
                    assessed_case_count,
                    compounding_case_count,
                    sustained_case_count,
                    watch_case_count,
                    decaying_case_count,
                    regressed_case_count,
                    remediation_case_count,
                    average_value_persistence_pct,
                    average_efficiency_retention_pct,
                    average_projected_roi_pct,
                    total_baseline_realized_net_value_amount,
                    total_current_projected_net_value_amount,
                    total_compounding_value_amount,
                    total_decayed_value_amount,
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
                    CURRENT_TIMESTAMP
                )
                """,
                snapshotId,
                snapshotNumber,

                summary.caseCount(),
                summary.assessedCaseCount(),

                summary.compoundingCaseCount(),
                summary.sustainedCaseCount(),
                summary.watchCaseCount(),
                summary.decayingCaseCount(),
                summary.regressedCaseCount(),
                summary.remediationCaseCount(),

                summary.averageValuePersistencePct(),
                summary.averageEfficiencyRetentionPct(),
                summary.averageProjectedRoiPct(),

                summary.totalBaselineRealizedNetValueAmount(),
                summary.totalCurrentProjectedNetValueAmount(),

                summary.totalCompoundingValueAmount(),
                summary.totalDecayedValueAmount(),

                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            ReinvestmentPersistenceCaseResponse persistenceCase
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_reinvestment_persistence_snapshot_items (
                    id,
                    snapshot_id,
                    persistence_case_id,
                    persistence_case_number,
                    source_performance_case_number,
                    redeployment_number,
                    target_value_case_number,
                    target_initiative_title,
                    currency,
                    case_status,
                    assessed,
                    baseline_annualized_value_amount,
                    current_annualized_value_amount,
                    baseline_horizon_value_amount,
                    current_projected_horizon_value_amount,
                    baseline_net_value_amount,
                    current_projected_net_value_amount,
                    baseline_roi_pct,
                    current_projected_roi_pct,
                    roi_variance_pct,
                    value_persistence_pct,
                    efficiency_retention_pct,
                    compounding_value_amount,
                    decayed_value_amount,
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
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                snapshotId,

                persistenceCase.id(),
                persistenceCase.persistenceCaseNumber(),
                persistenceCase.sourcePerformanceCaseNumber(),
                persistenceCase.redeploymentNumber(),

                persistenceCase.targetValueCaseNumber(),
                persistenceCase.targetInitiativeTitle(),

                persistenceCase.currency(),

                persistenceCase.status()
                        .name(),

                persistenceCase.assessed(),

                persistenceCase.baselineValidatedAnnualizedValueAmount(),
                persistenceCase.currentValidatedAnnualizedValueAmount(),

                persistenceCase.baselineRealizedHorizonValueAmount(),
                persistenceCase.currentProjectedHorizonValueAmount(),

                persistenceCase.baselineRealizedNetValueAmount(),
                persistenceCase.currentProjectedNetValueAmount(),

                persistenceCase.baselineRealizedRoiPct(),
                persistenceCase.currentProjectedRoiPct(),
                persistenceCase.roiVariancePct(),

                persistenceCase.valuePersistencePct(),
                persistenceCase.efficiencyRetentionPct(),

                persistenceCase.compoundingValueAmount(),
                persistenceCase.decayedValueAmount(),

                persistenceCase.health()
                        .name()
        );
    }

    public SnapshotRow findSnapshot(
            UUID snapshotId
    ) {
        return jdbcTemplate.query(
                snapshotSql()
                        + """
                        WHERE persistence_snapshot.id = ?
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
                            persistence_snapshot.captured_at DESC

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
                    persistence_case_id,
                    persistence_case_number,
                    source_performance_case_number,
                    redeployment_number,
                    target_value_case_number,
                    target_initiative_title,
                    currency,
                    case_status,
                    assessed,
                    baseline_annualized_value_amount,
                    current_annualized_value_amount,
                    baseline_horizon_value_amount,
                    current_projected_horizon_value_amount,
                    baseline_net_value_amount,
                    current_projected_net_value_amount,
                    baseline_roi_pct,
                    current_projected_roi_pct,
                    roi_variance_pct,
                    value_persistence_pct,
                    efficiency_retention_pct,
                    compounding_value_amount,
                    decayed_value_amount,
                    health

                FROM procurement_reinvestment_persistence_snapshot_items

                WHERE snapshot_id = ?

                ORDER BY
                    CASE health
                        WHEN 'REGRESSED'
                        THEN 1
                        WHEN 'DECAYING'
                        THEN 2
                        WHEN 'WATCH'
                        THEN 3
                        WHEN 'SUSTAINED'
                        THEN 4
                        WHEN 'COMPOUNDING'
                        THEN 5
                        ELSE 6
                    END,

                    value_persistence_pct,
                    persistence_case_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "persistence_case_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "persistence_case_number"
                                ),
                                resultSet.getString(
                                        "source_performance_case_number"
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

                                ReinvestmentPersistenceStatus.valueOf(
                                        resultSet.getString(
                                                "case_status"
                                        )
                                ),

                                resultSet.getBoolean(
                                        "assessed"
                                ),

                                resultSet.getBigDecimal(
                                        "baseline_annualized_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "current_annualized_value_amount"
                                ),

                                resultSet.getBigDecimal(
                                        "baseline_horizon_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "current_projected_horizon_value_amount"
                                ),

                                resultSet.getBigDecimal(
                                        "baseline_net_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "current_projected_net_value_amount"
                                ),

                                resultSet.getBigDecimal(
                                        "baseline_roi_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "current_projected_roi_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "roi_variance_pct"
                                ),

                                resultSet.getBigDecimal(
                                        "value_persistence_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "efficiency_retention_pct"
                                ),

                                resultSet.getBigDecimal(
                                        "compounding_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "decayed_value_amount"
                                ),

                                ReinvestmentPersistenceHealth.valueOf(
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
                    persistence_case.id,
                    persistence_case.persistence_case_number,
                    persistence_case.source_performance_case_id,
                    persistence_case.source_performance_case_number,
                    persistence_case.redeployment_case_id,
                    persistence_case.redeployment_number,
                    persistence_case.recycling_source_id,
                    persistence_case.recycling_source_number,
                    persistence_case.target_value_case_id,
                    persistence_case.target_value_case_number,
                    persistence_case.target_initiative_number,
                    persistence_case.target_initiative_title,
                    persistence_case.currency,
                    persistence_case.fiscal_year,
                    persistence_case.redeployed_capital_amount,
                    persistence_case.baseline_validated_annualized_value_amount,
                    persistence_case.baseline_realized_horizon_value_amount,
                    persistence_case.baseline_realized_net_value_amount,
                    persistence_case.baseline_total_cost_amount,
                    persistence_case.baseline_realized_roi_pct,
                    persistence_case.baseline_realization_pct,
                    persistence_case.baseline_performance_health,
                    persistence_case.measurement_horizon_months,
                    persistence_case.persistence_observation_window_months,
                    persistence_case.minimum_value_persistence_pct,
                    persistence_case.minimum_efficiency_retention_pct,
                    persistence_case.persistence_owner_user_id,
                    persistence_case.persistence_owner_name_snapshot,
                    persistence_case.persistence_objective,
                    persistence_case.status,
                    persistence_case.close_note,

                    closer.full_name
                        AS closed_by_name,

                    persistence_case.closed_at,
                    persistence_case.created_at,
                    persistence_case.updated_at,
                    persistence_case.version

                FROM procurement_reinvestment_persistence_cases
                    persistence_case

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       persistence_case.closed_by_user_id

                """;
    }

    private String observationSql() {
        return """
                SELECT
                    persistence_observation.id,
                    persistence_observation.persistence_case_id,
                    persistence_observation.observed_on,
                    persistence_observation.reported_current_annualized_value_amount,
                    persistence_observation.evidence_note,

                    reporter.full_name
                        AS reported_by_name,

                    persistence_observation.reported_at

                FROM procurement_reinvestment_persistence_observations
                    persistence_observation

                JOIN app_users
                    reporter
                    ON reporter.id =
                       persistence_observation.reported_by_user_id

                """;
    }

    private String validationSql() {
        return """
                SELECT
                    persistence_validation.id,
                    persistence_validation.observation_id,
                    persistence_validation.decision,
                    persistence_validation.validated_current_annualized_value_amount,
                    persistence_validation.validation_note,

                    validator.full_name
                        AS validated_by_name,

                    persistence_validation.validated_at

                FROM procurement_reinvestment_persistence_validations
                    persistence_validation

                JOIN app_users
                    validator
                    ON validator.id =
                       persistence_validation.validated_by_user_id

                """;
    }

    private String reviewSql() {
        return """
                SELECT
                    persistence_review.id,
                    persistence_review.persistence_case_id,
                    persistence_review.observation_id,
                    persistence_review.decision,
                    persistence_review.health,

                    persistence_review.baseline_validated_annualized_value_amount,
                    persistence_review.current_validated_annualized_value_amount,

                    persistence_review.baseline_realized_horizon_value_amount,
                    persistence_review.current_projected_horizon_value_amount,

                    persistence_review.baseline_realized_net_value_amount,
                    persistence_review.current_projected_net_value_amount,

                    persistence_review.baseline_realized_roi_pct,
                    persistence_review.current_projected_roi_pct,
                    persistence_review.roi_variance_pct,

                    persistence_review.value_persistence_pct,

                    persistence_review.compounding_value_amount,
                    persistence_review.decayed_value_amount,

                    persistence_review.baseline_capital_efficiency_multiple,
                    persistence_review.current_capital_efficiency_multiple,
                    persistence_review.capital_efficiency_delta,
                    persistence_review.efficiency_retention_pct,

                    persistence_review.review_note,

                    reviewer.full_name
                        AS reviewed_by_name,

                    persistence_review.reviewed_at

                FROM procurement_reinvestment_persistence_reviews
                    persistence_review

                JOIN app_users
                    reviewer
                    ON reviewer.id =
                       persistence_review.reviewed_by_user_id

                """;
    }

    private String snapshotSql() {
        return """
                SELECT
                    persistence_snapshot.id,
                    persistence_snapshot.snapshot_number,

                    persistence_snapshot.case_count,
                    persistence_snapshot.assessed_case_count,

                    persistence_snapshot.compounding_case_count,
                    persistence_snapshot.sustained_case_count,
                    persistence_snapshot.watch_case_count,
                    persistence_snapshot.decaying_case_count,
                    persistence_snapshot.regressed_case_count,
                    persistence_snapshot.remediation_case_count,

                    persistence_snapshot.average_value_persistence_pct,
                    persistence_snapshot.average_efficiency_retention_pct,
                    persistence_snapshot.average_projected_roi_pct,

                    persistence_snapshot.total_baseline_realized_net_value_amount,
                    persistence_snapshot.total_current_projected_net_value_amount,

                    persistence_snapshot.total_compounding_value_amount,
                    persistence_snapshot.total_decayed_value_amount,

                    user_account.full_name
                        AS captured_by_name,

                    persistence_snapshot.captured_at

                FROM procurement_reinvestment_persistence_snapshots
                    persistence_snapshot

                JOIN app_users
                    user_account
                    ON user_account.id =
                       persistence_snapshot.captured_by_user_id

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
                        "persistence_case_number"
                ),

                resultSet.getObject(
                        "source_performance_case_id",
                        UUID.class
                ),

                resultSet.getString(
                        "source_performance_case_number"
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
                        "baseline_validated_annualized_value_amount"
                ),

                resultSet.getBigDecimal(
                        "baseline_realized_horizon_value_amount"
                ),

                resultSet.getBigDecimal(
                        "baseline_realized_net_value_amount"
                ),

                resultSet.getBigDecimal(
                        "baseline_total_cost_amount"
                ),

                resultSet.getBigDecimal(
                        "baseline_realized_roi_pct"
                ),

                resultSet.getBigDecimal(
                        "baseline_realization_pct"
                ),

                ReinvestmentPerformanceHealth.valueOf(
                        resultSet.getString(
                                "baseline_performance_health"
                        )
                ),

                resultSet.getInt(
                        "measurement_horizon_months"
                ),

                resultSet.getInt(
                        "persistence_observation_window_months"
                ),

                resultSet.getBigDecimal(
                        "minimum_value_persistence_pct"
                ),

                resultSet.getBigDecimal(
                        "minimum_efficiency_retention_pct"
                ),

                resultSet.getObject(
                        "persistence_owner_user_id",
                        UUID.class
                ),

                resultSet.getString(
                        "persistence_owner_name_snapshot"
                ),

                resultSet.getString(
                        "persistence_objective"
                ),

                ReinvestmentPersistenceStatus.valueOf(
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
                        "persistence_case_id",
                        UUID.class
                ),

                resultSet.getObject(
                        "observed_on",
                        LocalDate.class
                ),

                resultSet.getBigDecimal(
                        "reported_current_annualized_value_amount"
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

                ReinvestmentPersistenceValidationDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),

                resultSet.getBigDecimal(
                        "validated_current_annualized_value_amount"
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
                        "persistence_case_id",
                        UUID.class
                ),

                resultSet.getObject(
                        "observation_id",
                        UUID.class
                ),

                ReinvestmentPersistenceReviewDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),

                ReinvestmentPersistenceHealth.valueOf(
                        resultSet.getString(
                                "health"
                        )
                ),

                resultSet.getBigDecimal(
                        "baseline_validated_annualized_value_amount"
                ),

                resultSet.getBigDecimal(
                        "current_validated_annualized_value_amount"
                ),

                resultSet.getBigDecimal(
                        "baseline_realized_horizon_value_amount"
                ),

                resultSet.getBigDecimal(
                        "current_projected_horizon_value_amount"
                ),

                resultSet.getBigDecimal(
                        "baseline_realized_net_value_amount"
                ),

                resultSet.getBigDecimal(
                        "current_projected_net_value_amount"
                ),

                resultSet.getBigDecimal(
                        "baseline_realized_roi_pct"
                ),

                resultSet.getBigDecimal(
                        "current_projected_roi_pct"
                ),

                resultSet.getBigDecimal(
                        "roi_variance_pct"
                ),

                resultSet.getBigDecimal(
                        "value_persistence_pct"
                ),

                resultSet.getBigDecimal(
                        "compounding_value_amount"
                ),

                resultSet.getBigDecimal(
                        "decayed_value_amount"
                ),

                resultSet.getBigDecimal(
                        "baseline_capital_efficiency_multiple"
                ),

                resultSet.getBigDecimal(
                        "current_capital_efficiency_multiple"
                ),

                resultSet.getBigDecimal(
                        "capital_efficiency_delta"
                ),

                resultSet.getBigDecimal(
                        "efficiency_retention_pct"
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
                        "compounding_case_count"
                ),

                resultSet.getInt(
                        "sustained_case_count"
                ),

                resultSet.getInt(
                        "watch_case_count"
                ),

                resultSet.getInt(
                        "decaying_case_count"
                ),

                resultSet.getInt(
                        "regressed_case_count"
                ),

                resultSet.getInt(
                        "remediation_case_count"
                ),

                resultSet.getBigDecimal(
                        "average_value_persistence_pct"
                ),

                resultSet.getBigDecimal(
                        "average_efficiency_retention_pct"
                ),

                resultSet.getBigDecimal(
                        "average_projected_roi_pct"
                ),

                resultSet.getBigDecimal(
                        "total_baseline_realized_net_value_amount"
                ),

                resultSet.getBigDecimal(
                        "total_current_projected_net_value_amount"
                ),

                resultSet.getBigDecimal(
                        "total_compounding_value_amount"
                ),

                resultSet.getBigDecimal(
                        "total_decayed_value_amount"
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
            String persistenceCaseNumber,

            UUID sourcePerformanceCaseId,
            String sourcePerformanceCaseNumber,

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

            BigDecimal baselineValidatedAnnualizedValueAmount,
            BigDecimal baselineRealizedHorizonValueAmount,
            BigDecimal baselineRealizedNetValueAmount,
            BigDecimal baselineTotalCostAmount,

            BigDecimal baselineRealizedRoiPct,
            BigDecimal baselineRealizationPct,

            ReinvestmentPerformanceHealth baselinePerformanceHealth,

            int measurementHorizonMonths,
            int persistenceObservationWindowMonths,

            BigDecimal minimumValuePersistencePct,
            BigDecimal minimumEfficiencyRetentionPct,

            UUID persistenceOwnerUserId,
            String persistenceOwnerName,
            String persistenceObjective,

            ReinvestmentPersistenceStatus status,

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
            UUID persistenceCaseId,
            LocalDate observedOn,
            BigDecimal reportedCurrentAnnualizedValueAmount,
            String evidenceNote,
            String reportedByName,
            Instant reportedAt
    ) {
    }

    public record ValidationRow(
            UUID id,
            UUID observationId,
            ReinvestmentPersistenceValidationDecision decision,
            BigDecimal validatedCurrentAnnualizedValueAmount,
            String validationNote,
            String validatedByName,
            Instant validatedAt
    ) {
    }

    public record AssessedObservationRow(
            UUID observationId,
            LocalDate observedOn,
            BigDecimal validatedCurrentAnnualizedValueAmount,
            Instant validatedAt
    ) {
    }

    public record ReviewRow(
            UUID id,
            UUID persistenceCaseId,
            UUID observationId,

            ReinvestmentPersistenceReviewDecision decision,
            ReinvestmentPersistenceHealth health,

            BigDecimal baselineAnnualizedValueAmount,
            BigDecimal currentAnnualizedValueAmount,

            BigDecimal baselineHorizonValueAmount,
            BigDecimal currentProjectedHorizonValueAmount,

            BigDecimal baselineNetValueAmount,
            BigDecimal currentProjectedNetValueAmount,

            BigDecimal baselineRoiPct,
            BigDecimal currentProjectedRoiPct,
            BigDecimal roiVariancePct,

            BigDecimal valuePersistencePct,
            BigDecimal compoundingValueAmount,
            BigDecimal decayedValueAmount,

            BigDecimal baselineCapitalEfficiencyMultiple,
            BigDecimal currentCapitalEfficiencyMultiple,
            BigDecimal capitalEfficiencyDelta,
            BigDecimal efficiencyRetentionPct,

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

            int compoundingCaseCount,
            int sustainedCaseCount,
            int watchCaseCount,
            int decayingCaseCount,
            int regressedCaseCount,
            int remediationCaseCount,

            BigDecimal averageValuePersistencePct,
            BigDecimal averageEfficiencyRetentionPct,
            BigDecimal averageProjectedRoiPct,

            BigDecimal totalBaselineRealizedNetValueAmount,
            BigDecimal totalCurrentProjectedNetValueAmount,

            BigDecimal totalCompoundingValueAmount,
            BigDecimal totalDecayedValueAmount,

            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID persistenceCaseId,
            String persistenceCaseNumber,
            String sourcePerformanceCaseNumber,
            String redeploymentNumber,
            String targetValueCaseNumber,
            String targetInitiativeTitle,
            String currency,

            ReinvestmentPersistenceStatus caseStatus,
            boolean assessed,

            BigDecimal baselineAnnualizedValueAmount,
            BigDecimal currentAnnualizedValueAmount,

            BigDecimal baselineHorizonValueAmount,
            BigDecimal currentProjectedHorizonValueAmount,

            BigDecimal baselineNetValueAmount,
            BigDecimal currentProjectedNetValueAmount,

            BigDecimal baselineRoiPct,
            BigDecimal currentProjectedRoiPct,
            BigDecimal roiVariancePct,

            BigDecimal valuePersistencePct,
            BigDecimal efficiencyRetentionPct,

            BigDecimal compoundingValueAmount,
            BigDecimal decayedValueAmount,

            ReinvestmentPersistenceHealth health
    ) {
    }
}
