package com.procureiq.strategicvalue;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class StrategicValueRepository {

    private final JdbcTemplate jdbcTemplate;

    public StrategicValueRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCaseSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategic_value_case_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextReviewSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategic_value_review_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<StrategicValueUserOptionResponse> users() {
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
                        new StrategicValueUserOptionResponse(
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
            UUID persistencePlanId,
            String persistencePlanNumber,
            UUID commitmentId,
            String commitmentNumber,
            UUID roadmapId,
            String roadmapNumber,
            String initiativeNumber,
            String initiativeTitle,
            UUID valueOwnerUserId,
            String valueOwnerName,
            String currency,
            int fiscalYear,
            BigDecimal step53ValidatedContributionPoints,
            BigDecimal persistenceBaselinePoints,
            StrategicValueCaseInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategic_value_cases (
                    id,
                    case_number,
                    persistence_plan_id,
                    persistence_plan_number,
                    commitment_id,
                    commitment_number,
                    roadmap_id,
                    roadmap_number,
                    initiative_number,
                    initiative_title,
                    value_owner_user_id,
                    value_owner_name_snapshot,
                    currency,
                    fiscal_year,
                    step53_validated_contribution_points,
                    persistence_baseline_points,
                    investment_cost_amount,
                    annual_operating_cost_amount,
                    annualized_value_amount,
                    value_horizon_months,
                    target_roi_pct,
                    target_payback_months,
                    valuation_note,
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
                persistencePlanId,
                persistencePlanNumber,
                commitmentId,
                commitmentNumber,
                roadmapId,
                roadmapNumber,
                initiativeNumber,
                initiativeTitle,
                valueOwnerUserId,
                valueOwnerName,
                currency,
                fiscalYear,
                step53ValidatedContributionPoints,
                persistenceBaselinePoints,
                input.investmentCostAmount(),
                input.annualOperatingCostAmount(),
                input.annualizedValueAmount(),
                input.valueHorizonMonths(),
                input.targetRoiPct(),
                input.targetPaybackMonths(),
                input.valuationNote()
                        .trim(),
                currentUserId
        );
    }

    public CaseRow activeCaseForPersistencePlan(
            UUID persistencePlanId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE value_case.persistence_plan_id = ?
                        AND value_case.status <> 'CLOSED'

                        ORDER BY
                            value_case.created_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        ),
                persistencePlanId
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
                        WHERE value_case.id = ?
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
                            CASE value_case.status
                                WHEN 'READY_FOR_REVIEW'
                                THEN 1
                                WHEN 'ACTIVE'
                                THEN 2
                                WHEN 'VERIFIED'
                                THEN 3
                                ELSE 4
                            END,

                            value_case.created_at DESC
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

    public void markReadyForReview(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategic_value_cases

                SET
                    status = 'READY_FOR_REVIEW',
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'ACTIVE'
                """,
                caseId
        );
    }

    public void verifyCase(
            UUID caseId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategic_value_cases

                SET
                    status = 'VERIFIED',
                    verification_note = ?,
                    verified_by_user_id = ?,
                    verified_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1

                WHERE id = ?
                AND status = 'READY_FOR_REVIEW'
                """,
                note.trim(),
                currentUserId,
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
                UPDATE procurement_strategic_value_cases

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

    public void createReview(
            UUID reviewId,
            String reviewNumber,
            StrategicValueSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategic_value_reviews (
                    id,
                    review_number,
                    case_count,
                    verified_case_count,
                    at_risk_case_count,
                    watch_case_count,
                    strong_case_count,
                    total_investment_amount,
                    total_operating_cost_amount,
                    total_baseline_horizon_value_amount,
                    total_durable_horizon_value_amount,
                    total_decayed_value_amount,
                    total_cost_amount,
                    total_net_value_amount,
                    portfolio_roi_pct,
                    portfolio_payback_months,
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
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                reviewId,
                reviewNumber,
                summary.caseCount(),
                summary.verifiedCaseCount(),
                summary.atRiskCaseCount(),
                summary.watchCaseCount(),
                summary.strongCaseCount(),
                summary.totalInvestmentAmount(),
                summary.totalAnnualOperatingCostAmount(),
                summary.totalBaselineHorizonValueAmount(),
                summary.totalDurableHorizonValueAmount(),
                summary.totalDecayedValueAmount(),
                summary.totalCostAmount(),
                summary.totalNetValueAmount(),
                summary.portfolioRoiPct(),
                summary.portfolioPaybackMonths(),
                summary.portfolioHealth()
                        .name(),
                currentUserId
        );
    }

    public void createReviewItem(
            UUID reviewId,
            StrategicValueCaseResponse valueCase
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategic_value_review_items (
                    id,
                    review_id,
                    value_case_id,
                    case_number,
                    persistence_plan_number,
                    commitment_number,
                    initiative_number,
                    initiative_title,
                    value_owner_name,
                    case_status,
                    currency,
                    investment_cost_amount,
                    annual_operating_cost_amount,
                    annualized_value_amount,
                    persistence_pct,
                    baseline_horizon_value_amount,
                    durable_horizon_value_amount,
                    decayed_value_amount,
                    total_cost_amount,
                    net_value_amount,
                    roi_pct,
                    payback_months,
                    value_at_risk_amount,
                    value_health,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                reviewId,
                valueCase.id(),
                valueCase.caseNumber(),
                valueCase.persistencePlanNumber(),
                valueCase.commitmentNumber(),
                valueCase.initiativeNumber(),
                valueCase.initiativeTitle(),
                valueCase.valueOwnerName(),
                valueCase.status()
                        .name(),
                valueCase.currency(),
                valueCase.investmentCostAmount(),
                valueCase.annualOperatingCostAmount(),
                valueCase.annualizedValueAmount(),
                valueCase.persistencePct(),
                valueCase.baselineHorizonValueAmount(),
                valueCase.durableHorizonValueAmount(),
                valueCase.decayedValueAmount(),
                valueCase.totalCostAmount(),
                valueCase.netValueAmount(),
                valueCase.roiPct(),
                valueCase.paybackMonths(),
                valueCase.valueAtRiskAmount(),
                valueCase.valueHealth()
                        .name()
        );
    }

    public ReviewRow findReview(
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        WHERE value_review.id = ?
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
                            value_review.captured_at DESC

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
                    value_case_id,
                    case_number,
                    persistence_plan_number,
                    commitment_number,
                    initiative_number,
                    initiative_title,
                    value_owner_name,
                    case_status,
                    currency,
                    investment_cost_amount,
                    annual_operating_cost_amount,
                    annualized_value_amount,
                    persistence_pct,
                    baseline_horizon_value_amount,
                    durable_horizon_value_amount,
                    decayed_value_amount,
                    total_cost_amount,
                    net_value_amount,
                    roi_pct,
                    payback_months,
                    value_at_risk_amount,
                    value_health

                FROM procurement_strategic_value_review_items

                WHERE review_id = ?

                ORDER BY
                    CASE value_health
                        WHEN 'AT_RISK'
                        THEN 1
                        WHEN 'WATCH'
                        THEN 2
                        WHEN 'HEALTHY'
                        THEN 3
                        WHEN 'STRONG'
                        THEN 4
                        ELSE 5
                    END,

                    roi_pct DESC,
                    case_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ReviewItemRow(
                                resultSet.getObject(
                                        "value_case_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "case_number"
                                ),
                                resultSet.getString(
                                        "persistence_plan_number"
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
                                        "value_owner_name"
                                ),
                                StrategicValueCaseStatus.valueOf(
                                        resultSet.getString(
                                                "case_status"
                                        )
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "investment_cost_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "annual_operating_cost_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "annualized_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "persistence_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_horizon_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "durable_horizon_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "decayed_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "total_cost_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "net_value_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "roi_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "payback_months"
                                ),
                                resultSet.getBigDecimal(
                                        "value_at_risk_amount"
                                ),
                                StrategicValueHealth.valueOf(
                                        resultSet.getString(
                                                "value_health"
                                        )
                                )
                        ),
                reviewId
        );
    }

    private String caseSql() {
        return """
                SELECT
                    value_case.id,
                    value_case.case_number,
                    value_case.persistence_plan_id,
                    value_case.persistence_plan_number,
                    value_case.commitment_id,
                    value_case.commitment_number,
                    value_case.roadmap_id,
                    value_case.roadmap_number,
                    value_case.initiative_number,
                    value_case.initiative_title,
                    value_case.value_owner_user_id,
                    value_case.value_owner_name_snapshot,
                    value_case.currency,
                    value_case.fiscal_year,
                    value_case.step53_validated_contribution_points,
                    value_case.persistence_baseline_points,
                    value_case.investment_cost_amount,
                    value_case.annual_operating_cost_amount,
                    value_case.annualized_value_amount,
                    value_case.value_horizon_months,
                    value_case.target_roi_pct,
                    value_case.target_payback_months,
                    value_case.valuation_note,
                    value_case.status,
                    value_case.verification_note,

                    verifier.full_name
                        AS verified_by_name,

                    value_case.verified_at,
                    value_case.close_note,

                    closer.full_name
                        AS closed_by_name,

                    value_case.closed_at,
                    value_case.created_at,
                    value_case.updated_at,
                    value_case.version

                FROM procurement_strategic_value_cases
                    value_case

                LEFT JOIN app_users
                    verifier
                    ON verifier.id =
                       value_case.verified_by_user_id

                LEFT JOIN app_users
                    closer
                    ON closer.id =
                       value_case.closed_by_user_id

                """;
    }

    private String reviewSql() {
        return """
                SELECT
                    value_review.id,
                    value_review.review_number,
                    value_review.case_count,
                    value_review.verified_case_count,
                    value_review.at_risk_case_count,
                    value_review.watch_case_count,
                    value_review.strong_case_count,
                    value_review.total_investment_amount,
                    value_review.total_operating_cost_amount,
                    value_review.total_baseline_horizon_value_amount,
                    value_review.total_durable_horizon_value_amount,
                    value_review.total_decayed_value_amount,
                    value_review.total_cost_amount,
                    value_review.total_net_value_amount,
                    value_review.portfolio_roi_pct,
                    value_review.portfolio_payback_months,
                    value_review.portfolio_health,

                    user_account.full_name
                        AS captured_by_name,

                    value_review.captured_at

                FROM procurement_strategic_value_reviews
                    value_review

                JOIN app_users
                    user_account
                    ON user_account.id =
                       value_review.captured_by_user_id

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
                        "case_number"
                ),
                resultSet.getObject(
                        "persistence_plan_id",
                        UUID.class
                ),
                resultSet.getString(
                        "persistence_plan_number"
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
                resultSet.getObject(
                        "value_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "value_owner_name_snapshot"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getBigDecimal(
                        "step53_validated_contribution_points"
                ),
                resultSet.getBigDecimal(
                        "persistence_baseline_points"
                ),
                resultSet.getBigDecimal(
                        "investment_cost_amount"
                ),
                resultSet.getBigDecimal(
                        "annual_operating_cost_amount"
                ),
                resultSet.getBigDecimal(
                        "annualized_value_amount"
                ),
                resultSet.getInt(
                        "value_horizon_months"
                ),
                resultSet.getBigDecimal(
                        "target_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "target_payback_months"
                ),
                resultSet.getString(
                        "valuation_note"
                ),
                StrategicValueCaseStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
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
                        "case_count"
                ),
                resultSet.getInt(
                        "verified_case_count"
                ),
                resultSet.getInt(
                        "at_risk_case_count"
                ),
                resultSet.getInt(
                        "watch_case_count"
                ),
                resultSet.getInt(
                        "strong_case_count"
                ),
                resultSet.getBigDecimal(
                        "total_investment_amount"
                ),
                resultSet.getBigDecimal(
                        "total_operating_cost_amount"
                ),
                resultSet.getBigDecimal(
                        "total_baseline_horizon_value_amount"
                ),
                resultSet.getBigDecimal(
                        "total_durable_horizon_value_amount"
                ),
                resultSet.getBigDecimal(
                        "total_decayed_value_amount"
                ),
                resultSet.getBigDecimal(
                        "total_cost_amount"
                ),
                resultSet.getBigDecimal(
                        "total_net_value_amount"
                ),
                resultSet.getBigDecimal(
                        "portfolio_roi_pct"
                ),
                resultSet.getBigDecimal(
                        "portfolio_payback_months"
                ),
                StrategicValueHealth.valueOf(
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

    public record CaseRow(
            UUID id,
            String caseNumber,
            UUID persistencePlanId,
            String persistencePlanNumber,
            UUID commitmentId,
            String commitmentNumber,
            UUID roadmapId,
            String roadmapNumber,
            String initiativeNumber,
            String initiativeTitle,
            UUID valueOwnerUserId,
            String valueOwnerName,
            String currency,
            int fiscalYear,
            BigDecimal step53ValidatedContributionPoints,
            BigDecimal persistenceBaselinePoints,
            BigDecimal investmentCostAmount,
            BigDecimal annualOperatingCostAmount,
            BigDecimal annualizedValueAmount,
            int valueHorizonMonths,
            BigDecimal targetRoiPct,
            BigDecimal targetPaybackMonths,
            String valuationNote,
            StrategicValueCaseStatus status,
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

    public record ReviewRow(
            UUID id,
            String reviewNumber,
            int caseCount,
            int verifiedCaseCount,
            int atRiskCaseCount,
            int watchCaseCount,
            int strongCaseCount,
            BigDecimal totalInvestmentAmount,
            BigDecimal totalOperatingCostAmount,
            BigDecimal totalBaselineHorizonValueAmount,
            BigDecimal totalDurableHorizonValueAmount,
            BigDecimal totalDecayedValueAmount,
            BigDecimal totalCostAmount,
            BigDecimal totalNetValueAmount,
            BigDecimal portfolioRoiPct,
            BigDecimal portfolioPaybackMonths,
            StrategicValueHealth portfolioHealth,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record ReviewItemRow(
            UUID valueCaseId,
            String caseNumber,
            String persistencePlanNumber,
            String commitmentNumber,
            String initiativeNumber,
            String initiativeTitle,
            String valueOwnerName,
            StrategicValueCaseStatus caseStatus,
            String currency,
            BigDecimal investmentCostAmount,
            BigDecimal annualOperatingCostAmount,
            BigDecimal annualizedValueAmount,
            BigDecimal persistencePct,
            BigDecimal baselineHorizonValueAmount,
            BigDecimal durableHorizonValueAmount,
            BigDecimal decayedValueAmount,
            BigDecimal totalCostAmount,
            BigDecimal netValueAmount,
            BigDecimal roiPct,
            BigDecimal paybackMonths,
            BigDecimal valueAtRiskAmount,
            StrategicValueHealth valueHealth
    ) {
    }
}
