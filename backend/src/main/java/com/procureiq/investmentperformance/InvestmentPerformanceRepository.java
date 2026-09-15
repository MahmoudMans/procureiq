package com.procureiq.investmentperformance;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class InvestmentPerformanceRepository {

    private final JdbcTemplate jdbcTemplate;

    public InvestmentPerformanceRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCaseSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_investment_performance_case_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextSnapshotSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_investment_performance_snapshot_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<InvestmentPerformanceUserOptionResponse> users() {
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
                        new InvestmentPerformanceUserOptionResponse(
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
            UUID fundingCommitmentId,
            String fundingCommitmentNumber,
            String allocationCycleNumber,
            UUID valueCaseId,
            String valueCaseNumber,
            String initiativeNumber,
            String initiativeTitle,
            String currency,
            int fiscalYear,
            InvestmentPerformanceCaseInput input,
            String ownerName,
            BigDecimal baselineInvestmentCostAmount,
            BigDecimal baselineAnnualOperatingCostAmount,
            BigDecimal baselineAnnualizedValueAmount,
            BigDecimal baselineDurableAnnualValueAmount,
            BigDecimal baselineDurableHorizonValueAmount,
            BigDecimal baselineRoiPct,
            BigDecimal baselineTargetRoiPct,
            BigDecimal baselineTargetPaybackMonths,
            int valueHorizonMonths,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investment_performance_cases (
                    id,
                    performance_case_number,
                    funding_commitment_id,
                    funding_commitment_number,
                    allocation_cycle_number,
                    value_case_id,
                    value_case_number,
                    initiative_number,
                    initiative_title,
                    currency,
                    fiscal_year,
                    performance_owner_user_id,
                    performance_owner_name_snapshot,
                    baseline_investment_cost_amount,
                    baseline_annual_operating_cost_amount,
                    baseline_annualized_value_amount,
                    baseline_durable_annual_value_amount,
                    baseline_durable_horizon_value_amount,
                    baseline_roi_pct,
                    baseline_target_roi_pct,
                    baseline_target_payback_months,
                    value_horizon_months,
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
                fundingCommitmentId,
                fundingCommitmentNumber,
                allocationCycleNumber,
                valueCaseId,
                valueCaseNumber,
                initiativeNumber,
                initiativeTitle,
                currency,
                fiscalYear,
                input.performanceOwnerUserId(),
                ownerName,
                baselineInvestmentCostAmount,
                baselineAnnualOperatingCostAmount,
                baselineAnnualizedValueAmount,
                baselineDurableAnnualValueAmount,
                baselineDurableHorizonValueAmount,
                baselineRoiPct,
                baselineTargetRoiPct,
                baselineTargetPaybackMonths,
                valueHorizonMonths,
                input.performanceObjective()
                        .trim(),
                currentUserId
        );
    }

    public CaseRow activeCaseForFundingCommitment(
            UUID fundingCommitmentId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE performance_case.funding_commitment_id = ?
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
                fundingCommitmentId
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
                                WHEN 'IN_REMEDIATION'
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
            InvestmentPerformanceObservationInput input,
            BigDecimal releasedCapitalSnapshot,
            BigDecimal releasePctSnapshot,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investment_performance_observations (
                    id,
                    performance_case_id,
                    observed_on,
                    released_capital_snapshot,
                    release_pct_snapshot,
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
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                observationId,
                caseId,
                input.observedOn(),
                releasedCapitalSnapshot,
                releasePctSnapshot,
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

    public ValidationRow findValidation(
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
            InvestmentPerformanceValidationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investment_performance_validations (
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
                        == InvestmentPerformanceValidationDecision.VALIDATED
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
                    performance_observation.released_capital_snapshot,
                    performance_observation.release_pct_snapshot,

                    performance_validation.validated_realized_annualized_value_amount,
                    performance_validation.validated_at

                FROM procurement_investment_performance_observations
                    performance_observation

                JOIN procurement_investment_performance_validations
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
                                        "released_capital_snapshot"
                                ),
                                resultSet.getBigDecimal(
                                        "release_pct_snapshot"
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
                UPDATE procurement_investment_performance_cases

                SET
                    status = 'READY_FOR_REVIEW',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status IN (
                    'ACTIVE',
                    'IN_REMEDIATION'
                )
                """,
                caseId
        );
    }

    public void markVerified(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_investment_performance_cases

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

    public void markRemediation(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_investment_performance_cases

                SET
                    status = 'IN_REMEDIATION',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_REVIEW'
                """,
                caseId
        );
    }

    public void createDecision(
            UUID decisionId,
            UUID caseId,
            UUID observationId,
            InvestmentPerformanceReviewInput input,
            InvestmentPerformanceMetricResult metric,
            BigDecimal validatedRealizedAnnualizedValueAmount,
            BigDecimal baselineRoiPct,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investment_performance_decisions (
                    id,
                    performance_case_id,
                    observation_id,
                    decision,
                    health,
                    released_capital_amount,
                    validated_realized_annualized_value_amount,
                    realized_horizon_value_amount,
                    realized_total_cost_amount,
                    realized_net_value_amount,
                    realized_roi_pct,
                    baseline_roi_pct,
                    roi_variance_pct,
                    funding_variance_amount,
                    funding_variance_pct,
                    capital_efficiency_multiple,
                    value_variance_amount,
                    decision_note,
                    decided_by_user_id,
                    decided_at
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
                decisionId,
                caseId,
                observationId,
                input.decision()
                        .name(),
                metric.health()
                        .name(),
                metric.releasedCapitalAmount(),
                validatedRealizedAnnualizedValueAmount,
                metric.realizedHorizonValueAmount(),
                metric.realizedTotalCostAmount(),
                metric.realizedNetValueAmount(),
                metric.realizedRoiPct(),
                baselineRoiPct,
                metric.roiVariancePct(),
                metric.fundingVarianceAmount(),
                metric.fundingVariancePct(),
                metric.capitalEfficiencyMultiple(),
                metric.valueVarianceAmount(),
                input.decisionNote()
                        .trim(),
                currentUserId
        );
    }

    public List<DecisionRow> decisions(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                decisionSql()
                        + """
                        WHERE performance_decision.performance_case_id = ?

                        ORDER BY
                            performance_decision.decided_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDecision(
                                resultSet
                        ),
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
                UPDATE procurement_investment_performance_cases

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
            InvestmentPerformanceSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investment_performance_snapshots (
                    id,
                    snapshot_number,
                    case_count,
                    assessed_case_count,
                    outperforming_case_count,
                    on_track_case_count,
                    watch_case_count,
                    underperforming_case_count,
                    average_realized_roi_pct,
                    average_roi_variance_pct,
                    average_funding_variance_pct,
                    average_capital_efficiency_multiple,
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
                summary.averageRealizedRoiPct(),
                summary.averageRoiVariancePct(),
                summary.averageFundingVariancePct(),
                summary.averageCapitalEfficiencyMultiple(),
                currentUserId
        );
    }

    public void createSnapshotItem(
            UUID snapshotId,
            InvestmentPerformanceCaseResponse performanceCase
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investment_performance_snapshot_items (
                    id,
                    snapshot_id,
                    performance_case_id,
                    performance_case_number,
                    funding_commitment_number,
                    value_case_number,
                    initiative_number,
                    initiative_title,
                    currency,
                    case_status,
                    assessed,
                    released_capital_amount,
                    baseline_investment_cost_amount,
                    baseline_durable_horizon_value_amount,
                    validated_realized_annualized_value_amount,
                    realized_horizon_value_amount,
                    realized_net_value_amount,
                    baseline_roi_pct,
                    realized_roi_pct,
                    roi_variance_pct,
                    funding_variance_amount,
                    funding_variance_pct,
                    capital_efficiency_multiple,
                    value_variance_amount,
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
                performanceCase.id(),
                performanceCase.performanceCaseNumber(),
                performanceCase.fundingCommitmentNumber(),
                performanceCase.valueCaseNumber(),
                performanceCase.initiativeNumber(),
                performanceCase.initiativeTitle(),
                performanceCase.currency(),
                performanceCase.status()
                        .name(),
                performanceCase.assessed(),
                performanceCase.assessedReleasedCapitalAmount(),
                performanceCase.baselineInvestmentCostAmount(),
                performanceCase.baselineDurableHorizonValueAmount(),
                performanceCase.validatedRealizedAnnualizedValueAmount(),
                performanceCase.realizedHorizonValueAmount(),
                performanceCase.realizedNetValueAmount(),
                performanceCase.baselineRoiPct(),
                performanceCase.realizedRoiPct(),
                performanceCase.roiVariancePct(),
                performanceCase.fundingVarianceAmount(),
                performanceCase.fundingVariancePct(),
                performanceCase.capitalEfficiencyMultiple(),
                performanceCase.valueVarianceAmount(),
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
                    funding_commitment_number,
                    value_case_number,
                    initiative_number,
                    initiative_title,
                    currency,
                    case_status,
                    assessed,
                    released_capital_amount,
                    baseline_investment_cost_amount,
                    baseline_durable_horizon_value_amount,
                    validated_realized_annualized_value_amount,
                    realized_horizon_value_amount,
                    realized_net_value_amount,
                    baseline_roi_pct,
                    realized_roi_pct,
                    roi_variance_pct,
                    funding_variance_amount,
                    funding_variance_pct,
                    capital_efficiency_multiple,
                    value_variance_amount,
                    health

                FROM procurement_investment_performance_snapshot_items

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

                    roi_variance_pct,
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
                                        "funding_commitment_number"
                                ),
                                resultSet.getString(
                                        "value_case_number"
                                ),
                                resultSet.getString(
                                        "initiative_number"
                                ),
                                resultSet.getString(
                                        "initiative_title"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                InvestmentPerformanceCaseStatus.valueOf(
                                        resultSet.getString(
                                                "case_status"
                                        )
                                ),
                                resultSet.getBoolean(
                                        "assessed"
                                ),
                                resultSet.getBigDecimal(
                                        "released_capital_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_investment_cost_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_durable_horizon_value_amount"
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
                                        "baseline_roi_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "realized_roi_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "roi_variance_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "funding_variance_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "funding_variance_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "capital_efficiency_multiple"
                                ),
                                resultSet.getBigDecimal(
                                        "value_variance_amount"
                                ),
                                InvestmentPerformanceHealth.valueOf(
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
                    performance_case.funding_commitment_id,
                    performance_case.funding_commitment_number,
                    performance_case.allocation_cycle_number,
                    performance_case.value_case_id,
                    performance_case.value_case_number,
                    performance_case.initiative_number,
                    performance_case.initiative_title,
                    performance_case.currency,
                    performance_case.fiscal_year,
                    performance_case.performance_owner_user_id,
                    performance_case.performance_owner_name_snapshot,
                    performance_case.baseline_investment_cost_amount,
                    performance_case.baseline_annual_operating_cost_amount,
                    performance_case.baseline_annualized_value_amount,
                    performance_case.baseline_durable_annual_value_amount,
                    performance_case.baseline_durable_horizon_value_amount,
                    performance_case.baseline_roi_pct,
                    performance_case.baseline_target_roi_pct,
                    performance_case.baseline_target_payback_months,
                    performance_case.value_horizon_months,
                    performance_case.performance_objective,
                    performance_case.status,
                    performance_case.close_note,

                    closer.full_name
                        AS closed_by_name,

                    performance_case.closed_at,
                    performance_case.created_at,
                    performance_case.updated_at,
                    performance_case.version

                FROM procurement_investment_performance_cases
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
                    performance_observation.released_capital_snapshot,
                    performance_observation.release_pct_snapshot,
                    performance_observation.reported_realized_annualized_value_amount,
                    performance_observation.evidence_note,

                    reporter.full_name
                        AS reported_by_name,

                    performance_observation.reported_at

                FROM procurement_investment_performance_observations
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

                FROM procurement_investment_performance_validations
                    performance_validation

                JOIN app_users
                    validator
                    ON validator.id =
                       performance_validation.validated_by_user_id

                """;
    }

    private String decisionSql() {
        return """
                SELECT
                    performance_decision.id,
                    performance_decision.performance_case_id,
                    performance_decision.observation_id,
                    performance_decision.decision,
                    performance_decision.health,
                    performance_decision.released_capital_amount,
                    performance_decision.validated_realized_annualized_value_amount,
                    performance_decision.realized_horizon_value_amount,
                    performance_decision.realized_total_cost_amount,
                    performance_decision.realized_net_value_amount,
                    performance_decision.realized_roi_pct,
                    performance_decision.baseline_roi_pct,
                    performance_decision.roi_variance_pct,
                    performance_decision.funding_variance_amount,
                    performance_decision.funding_variance_pct,
                    performance_decision.capital_efficiency_multiple,
                    performance_decision.value_variance_amount,
                    performance_decision.decision_note,

                    decider.full_name
                        AS decided_by_name,

                    performance_decision.decided_at

                FROM procurement_investment_performance_decisions
                    performance_decision

                JOIN app_users
                    decider
                    ON decider.id =
                       performance_decision.decided_by_user_id

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
                    performance_snapshot.average_realized_roi_pct,
                    performance_snapshot.average_roi_variance_pct,
                    performance_snapshot.average_funding_variance_pct,
                    performance_snapshot.average_capital_efficiency_multiple,

                    user_account.full_name
                        AS captured_by_name,

                    performance_snapshot.captured_at

                FROM procurement_investment_performance_snapshots
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
                        "funding_commitment_id",
                        UUID.class
                ),
                resultSet.getString(
                        "funding_commitment_number"
                ),
                resultSet.getString(
                        "allocation_cycle_number"
                ),
                resultSet.getObject(
                        "value_case_id",
                        UUID.class
                ),
                resultSet.getString(
                        "value_case_number"
                ),
                resultSet.getString(
                        "initiative_number"
                ),
                resultSet.getString(
                        "initiative_title"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getObject(
                        "performance_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "performance_owner_name_snapshot"
                ),
                resultSet.getBigDecimal(
                        "baseline_investment_cost_amount"
                ),
                resultSet.getBigDecimal(
                        "baseline_annual_operating_cost_amount"
                ),
                resultSet.getBigDecimal(
                        "baseline_annualized_value_amount"
                ),
                resultSet.getBigDecimal(
                        "baseline_durable_annual_value_amount"
                ),
                resultSet.getBigDecimal(
                        "baseline_durable_horizon_value_amount"
                ),
                resultSet.getBigDecimal(
                        "baseline_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "baseline_target_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "baseline_target_payback_months"
                ),
                resultSet.getInt(
                        "value_horizon_months"
                ),
                resultSet.getString(
                        "performance_objective"
                ),
                InvestmentPerformanceCaseStatus.valueOf(
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
                        "released_capital_snapshot"
                ),
                resultSet.getBigDecimal(
                        "release_pct_snapshot"
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
                InvestmentPerformanceValidationDecision.valueOf(
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

    private DecisionRow mapDecision(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new DecisionRow(
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
                InvestmentPerformanceReviewDecision.valueOf(
                        resultSet.getString(
                                "decision"
                        )
                ),
                InvestmentPerformanceHealth.valueOf(
                        resultSet.getString(
                                "health"
                        )
                ),
                resultSet.getBigDecimal(
                        "released_capital_amount"
                ),
                resultSet.getBigDecimal(
                        "validated_realized_annualized_value_amount"
                ),
                resultSet.getBigDecimal(
                        "realized_horizon_value_amount"
                ),
                resultSet.getBigDecimal(
                        "realized_total_cost_amount"
                ),
                resultSet.getBigDecimal(
                        "realized_net_value_amount"
                ),
                resultSet.getBigDecimal(
                        "realized_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "baseline_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "roi_variance_pct"
                ),
                resultSet.getBigDecimal(
                        "funding_variance_amount"
                ),
                resultSet.getBigDecimal(
                        "funding_variance_pct"
                ),
                resultSet.getBigDecimal(
                        "capital_efficiency_multiple"
                ),
                resultSet.getBigDecimal(
                        "value_variance_amount"
                ),
                resultSet.getString(
                        "decision_note"
                ),
                resultSet.getString(
                        "decided_by_name"
                ),
                resultSet.getTimestamp(
                        "decided_at"
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
                resultSet.getBigDecimal(
                        "average_realized_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "average_roi_variance_pct"
                ),
                resultSet.getBigDecimal(
                        "average_funding_variance_pct"
                ),
                resultSet.getBigDecimal(
                        "average_capital_efficiency_multiple"
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
            UUID fundingCommitmentId,
            String fundingCommitmentNumber,
            String allocationCycleNumber,
            UUID valueCaseId,
            String valueCaseNumber,
            String initiativeNumber,
            String initiativeTitle,
            String currency,
            int fiscalYear,
            UUID performanceOwnerUserId,
            String performanceOwnerName,
            BigDecimal baselineInvestmentCostAmount,
            BigDecimal baselineAnnualOperatingCostAmount,
            BigDecimal baselineAnnualizedValueAmount,
            BigDecimal baselineDurableAnnualValueAmount,
            BigDecimal baselineDurableHorizonValueAmount,
            BigDecimal baselineRoiPct,
            BigDecimal baselineTargetRoiPct,
            BigDecimal baselineTargetPaybackMonths,
            int valueHorizonMonths,
            String performanceObjective,
            InvestmentPerformanceCaseStatus status,
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
            BigDecimal releasedCapitalSnapshot,
            BigDecimal releasePctSnapshot,
            BigDecimal reportedRealizedAnnualizedValueAmount,
            String evidenceNote,
            String reportedByName,
            Instant reportedAt
    ) {
    }

    public record ValidationRow(
            UUID id,
            UUID observationId,
            InvestmentPerformanceValidationDecision decision,
            BigDecimal validatedRealizedAnnualizedValueAmount,
            String validationNote,
            String validatedByName,
            Instant validatedAt
    ) {
    }

    public record AssessedObservationRow(
            UUID observationId,
            LocalDate observedOn,
            BigDecimal releasedCapitalSnapshot,
            BigDecimal releasePctSnapshot,
            BigDecimal validatedRealizedAnnualizedValueAmount,
            Instant validatedAt
    ) {
    }

    public record DecisionRow(
            UUID id,
            UUID performanceCaseId,
            UUID observationId,
            InvestmentPerformanceReviewDecision decision,
            InvestmentPerformanceHealth health,
            BigDecimal releasedCapitalAmount,
            BigDecimal validatedRealizedAnnualizedValueAmount,
            BigDecimal realizedHorizonValueAmount,
            BigDecimal realizedTotalCostAmount,
            BigDecimal realizedNetValueAmount,
            BigDecimal realizedRoiPct,
            BigDecimal baselineRoiPct,
            BigDecimal roiVariancePct,
            BigDecimal fundingVarianceAmount,
            BigDecimal fundingVariancePct,
            BigDecimal capitalEfficiencyMultiple,
            BigDecimal valueVarianceAmount,
            String decisionNote,
            String decidedByName,
            Instant decidedAt
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
            BigDecimal averageRealizedRoiPct,
            BigDecimal averageRoiVariancePct,
            BigDecimal averageFundingVariancePct,
            BigDecimal averageCapitalEfficiencyMultiple,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record SnapshotItemRow(
            UUID performanceCaseId,
            String performanceCaseNumber,
            String fundingCommitmentNumber,
            String valueCaseNumber,
            String initiativeNumber,
            String initiativeTitle,
            String currency,
            InvestmentPerformanceCaseStatus caseStatus,
            boolean assessed,
            BigDecimal releasedCapitalAmount,
            BigDecimal baselineInvestmentCostAmount,
            BigDecimal baselineDurableHorizonValueAmount,
            BigDecimal validatedRealizedAnnualizedValueAmount,
            BigDecimal realizedHorizonValueAmount,
            BigDecimal realizedNetValueAmount,
            BigDecimal baselineRoiPct,
            BigDecimal realizedRoiPct,
            BigDecimal roiVariancePct,
            BigDecimal fundingVarianceAmount,
            BigDecimal fundingVariancePct,
            BigDecimal capitalEfficiencyMultiple,
            BigDecimal valueVarianceAmount,
            InvestmentPerformanceHealth health
    ) {
    }
}
