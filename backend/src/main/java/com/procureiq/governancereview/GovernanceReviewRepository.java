package com.procureiq.governancereview;

import com.procureiq.user.ProcurementRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class GovernanceReviewRepository {

    private final JdbcTemplate jdbcTemplate;

    public GovernanceReviewRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextReviewSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_governance_review_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextDecisionSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_governance_decision_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextActionSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_governance_action_number_seq'
                )
                """,
                Long.class
        );
    }

    public void createReview(
            UUID reviewId,
            String reviewNumber,
            GovernanceReviewInput input,
            String currency,
            UUID ownerUserId,
            UUID chairUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_governance_reviews (
                    id,
                    review_number,
                    title,
                    period_start,
                    period_end,
                    currency,
                    status,
                    owner_user_id,
                    chair_user_id,
                    executive_summary,
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
                    'DRAFT',
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                reviewId,
                reviewNumber,
                input.title()
                        .trim(),
                input.periodStart(),
                input.periodEnd(),
                currency,
                ownerUserId,
                chairUserId,
                input.executiveSummary()
                        .trim()
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

    public List<ReviewRow> reviews(
            String currency
    ) {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        WHERE review.currency = ?

                        ORDER BY
                            review.period_end DESC,
                            review.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapReview(
                                resultSet
                        ),
                currency
        );
    }

    public SnapshotMetricsRow currentMetrics(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                WITH params AS (
                    SELECT
                        ?::VARCHAR
                            AS currency
                ),

                latest_risk AS (
                    SELECT DISTINCT ON (
                        evaluation.supplier_id
                    )
                        evaluation.supplier_id,
                        evaluation.overall_score,
                        evaluation.risk_band,
                        evaluation.spend_exposure

                    FROM supplier_risk_evaluations
                        evaluation

                    WHERE
                        evaluation.currency =
                            (
                                SELECT currency
                                FROM params
                            )

                    ORDER BY
                        evaluation.supplier_id,
                        evaluation.evaluated_at DESC
                ),

                benefit_by_portfolio AS (
                    SELECT
                        portfolio.id,

                        portfolio.baseline_target_savings,

                        COALESCE(
                            SUM(
                                item.forecast_savings
                            )
                            FILTER (
                                WHERE
                                    item.status
                                        <> 'CANCELLED'
                            ),
                            0
                        )
                            AS forecast_savings,

                        COALESCE(
                            SUM(
                                initiative.realized_savings
                            )
                            FILTER (
                                WHERE
                                    item.status
                                        <> 'CANCELLED'
                            ),
                            0
                        )
                            AS operational_reported_savings,

                        COALESCE(
                            SUM(
                                item.validated_savings
                            ),
                            0
                        )
                            AS validated_savings,

                        COUNT(*)
                        FILTER (
                            WHERE
                                item.status =
                                    'VALIDATION_PENDING'
                        )
                            AS validation_pending_items

                    FROM procurement_execution_portfolios
                        portfolio

                    LEFT JOIN procurement_benefit_items
                        item
                        ON item.portfolio_id =
                           portfolio.id

                    LEFT JOIN procurement_category_initiatives
                        initiative
                        ON initiative.id =
                           item.initiative_id

                    WHERE
                        portfolio.currency =
                            (
                                SELECT currency
                                FROM params
                            )

                    AND portfolio.status
                        <> 'ARCHIVED'

                    GROUP BY
                        portfolio.id,
                        portfolio.baseline_target_savings
                ),

                leakage_by_portfolio AS (
                    SELECT
                        item.portfolio_id,

                        COUNT(*)
                        FILTER (
                            WHERE
                                leakage.status IN (
                                    'OPEN',
                                    'ACCEPTED'
                                )
                        )
                            AS active_leakage_cases,

                        COALESCE(
                            SUM(
                                leakage.amount
                            )
                            FILTER (
                                WHERE
                                    leakage.status IN (
                                        'OPEN',
                                        'ACCEPTED'
                                    )
                            ),
                            0
                        )
                            AS active_leakage_amount

                    FROM procurement_benefit_leakage
                        leakage

                    JOIN procurement_benefit_items
                        item
                        ON item.id =
                           leakage.benefit_item_id

                    JOIN procurement_execution_portfolios
                        portfolio
                        ON portfolio.id =
                           item.portfolio_id

                    WHERE
                        portfolio.currency =
                            (
                                SELECT currency
                                FROM params
                            )

                    AND portfolio.status
                        <> 'ARCHIVED'

                    GROUP BY
                        item.portfolio_id
                ),

                assumption_totals AS (
                    SELECT
                        COUNT(*)
                        FILTER (
                            WHERE
                                assumption.status =
                                    'ACTIVE'
                        )
                            AS active_assumptions,

                        COUNT(*)
                        FILTER (
                            WHERE
                                assumption.status =
                                    'INVALIDATED'
                        )
                            AS invalidated_assumptions

                    FROM procurement_benefit_assumptions
                        assumption

                    JOIN procurement_execution_portfolios
                        portfolio
                        ON portfolio.id =
                           assumption.portfolio_id

                    WHERE
                        portfolio.currency =
                            (
                                SELECT currency
                                FROM params
                            )

                    AND portfolio.status
                        <> 'ARCHIVED'
                )

                SELECT
                    (
                        SELECT COUNT(*)
                        FROM latest_risk
                    )
                        AS evaluated_suppliers,

                    (
                        SELECT COUNT(*)
                        FROM latest_risk
                        WHERE risk_band =
                            'HIGH'
                    )
                        AS high_risk_suppliers,

                    (
                        SELECT COUNT(*)
                        FROM latest_risk
                        WHERE risk_band =
                            'CRITICAL'
                    )
                        AS critical_risk_suppliers,

                    (
                        SELECT COALESCE(
                            SUM(
                                spend_exposure
                            ),
                            0
                        )
                        FROM latest_risk
                        WHERE risk_band IN (
                            'HIGH',
                            'CRITICAL'
                        )
                    )
                        AS spend_at_high_risk,

                    (
                        SELECT COUNT(*)

                        FROM supplier_risk_alerts
                            alert

                        JOIN supplier_risk_evaluations
                            evaluation
                            ON evaluation.id =
                               alert.evaluation_id

                        WHERE
                            evaluation.currency =
                                (
                                    SELECT currency
                                    FROM params
                                )

                        AND alert.status IN (
                            'OPEN',
                            'ACKNOWLEDGED'
                        )
                    )
                        AS active_risk_alerts,

                    (
                        SELECT COUNT(*)

                        FROM supplier_risk_escalation_cases
                            escalation

                        JOIN suppliers supplier
                            ON supplier.id =
                               escalation.supplier_id

                        WHERE escalation.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                    )
                        AS open_risk_escalations,

                    (
                        SELECT COUNT(*)

                        FROM procurement_category_strategies
                            strategy

                        WHERE
                            strategy.currency =
                                (
                                    SELECT currency
                                    FROM params
                                )

                        AND strategy.status =
                            'ACTIVE'
                    )
                        AS active_category_strategies,

                    (
                        SELECT COUNT(*)

                        FROM procurement_category_initiatives
                            initiative

                        JOIN procurement_category_strategies
                            strategy
                            ON strategy.id =
                               initiative.strategy_id

                        WHERE
                            strategy.currency =
                                (
                                    SELECT currency
                                    FROM params
                                )

                        AND initiative.status IN (
                            'PLANNED',
                            'READY',
                            'IN_PROGRESS'
                        )
                    )
                        AS active_category_initiatives,

                    (
                        SELECT COUNT(*)

                        FROM procurement_category_initiatives
                            initiative

                        JOIN procurement_category_strategies
                            strategy
                            ON strategy.id =
                               initiative.strategy_id

                        WHERE
                            strategy.currency =
                                (
                                    SELECT currency
                                    FROM params
                                )

                        AND initiative.status IN (
                            'PLANNED',
                            'READY',
                            'IN_PROGRESS'
                        )

                        AND initiative.planned_end_date
                            IS NOT NULL

                        AND initiative.planned_end_date
                            < CURRENT_DATE
                    )
                        AS overdue_category_initiatives,

                    (
                        SELECT COUNT(*)

                        FROM procurement_portfolio_scenarios
                            scenario

                        WHERE
                            scenario.currency =
                                (
                                    SELECT currency
                                    FROM params
                                )

                        AND scenario.status =
                            'APPROVED'
                    )
                        AS approved_scenarios,

                    (
                        SELECT COUNT(*)

                        FROM procurement_execution_portfolios
                            portfolio

                        WHERE
                            portfolio.currency =
                                (
                                    SELECT currency
                                    FROM params
                                )

                        AND portfolio.status IN (
                            'AUTHORIZED',
                            'IN_EXECUTION'
                        )
                    )
                        AS active_execution_portfolios,

                    (
                        SELECT COALESCE(
                            SUM(
                                baseline_target_savings
                            ),
                            0
                        )
                        FROM benefit_by_portfolio
                    )
                        AS baseline_target_savings,

                    (
                        SELECT COALESCE(
                            SUM(
                                forecast_savings
                            ),
                            0
                        )
                        FROM benefit_by_portfolio
                    )
                        AS forecast_savings,

                    (
                        SELECT COALESCE(
                            SUM(
                                operational_reported_savings
                            ),
                            0
                        )
                        FROM benefit_by_portfolio
                    )
                        AS operational_reported_savings,

                    (
                        SELECT COALESCE(
                            SUM(
                                validated_savings
                            ),
                            0
                        )
                        FROM benefit_by_portfolio
                    )
                        AS validated_savings,

                    (
                        SELECT COALESCE(
                            SUM(
                                validation_pending_items
                            ),
                            0
                        )
                        FROM benefit_by_portfolio
                    )
                        AS validation_pending_items,

                    (
                        SELECT COALESCE(
                            SUM(
                                active_leakage_cases
                            ),
                            0
                        )
                        FROM leakage_by_portfolio
                    )
                        AS active_leakage_cases,

                    (
                        SELECT COALESCE(
                            SUM(
                                active_leakage_amount
                            ),
                            0
                        )
                        FROM leakage_by_portfolio
                    )
                        AS active_leakage_amount,

                    (
                        SELECT COALESCE(
                            SUM(
                                GREATEST(
                                    benefit.baseline_target_savings
                                    -
                                    benefit.forecast_savings,
                                    0
                                )
                                +
                                COALESCE(
                                    leakage.active_leakage_amount,
                                    0
                                )
                            ),
                            0
                        )

                        FROM benefit_by_portfolio
                            benefit

                        LEFT JOIN leakage_by_portfolio
                            leakage
                            ON leakage.portfolio_id =
                               benefit.id
                    )
                        AS at_risk_amount,

                    COALESCE(
                        (
                            SELECT active_assumptions
                            FROM assumption_totals
                        ),
                        0
                    )
                        AS active_assumptions,

                    COALESCE(
                        (
                            SELECT invalidated_assumptions
                            FROM assumption_totals
                        ),
                        0
                    )
                        AS invalidated_assumptions
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotMetricsRow(
                                resultSet.getLong(
                                        "evaluated_suppliers"
                                ),
                                resultSet.getLong(
                                        "high_risk_suppliers"
                                ),
                                resultSet.getLong(
                                        "critical_risk_suppliers"
                                ),
                                resultSet.getBigDecimal(
                                        "spend_at_high_risk"
                                ),
                                resultSet.getLong(
                                        "active_risk_alerts"
                                ),
                                resultSet.getLong(
                                        "open_risk_escalations"
                                ),
                                resultSet.getLong(
                                        "active_category_strategies"
                                ),
                                resultSet.getLong(
                                        "active_category_initiatives"
                                ),
                                resultSet.getLong(
                                        "overdue_category_initiatives"
                                ),
                                resultSet.getLong(
                                        "approved_scenarios"
                                ),
                                resultSet.getLong(
                                        "active_execution_portfolios"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_target_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "forecast_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "operational_reported_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "validated_savings"
                                ),
                                resultSet.getLong(
                                        "validation_pending_items"
                                ),
                                resultSet.getLong(
                                        "active_leakage_cases"
                                ),
                                resultSet.getBigDecimal(
                                        "active_leakage_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "at_risk_amount"
                                ),
                                resultSet.getLong(
                                        "active_assumptions"
                                ),
                                resultSet.getLong(
                                        "invalidated_assumptions"
                                )
                        ),
                currency
        )
                .stream()
                .findFirst()
                .orElseThrow();
    }

    public List<SupplierRiskSnapshotRow> supplierRiskSnapshot(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                WITH latest_risk AS (
                    SELECT DISTINCT ON (
                        evaluation.supplier_id
                    )
                        evaluation.supplier_id,
                        evaluation.overall_score,
                        evaluation.risk_band,
                        evaluation.recommendation,
                        evaluation.spend_exposure

                    FROM supplier_risk_evaluations
                        evaluation

                    WHERE evaluation.currency = ?

                    ORDER BY
                        evaluation.supplier_id,
                        evaluation.evaluated_at DESC
                )

                SELECT
                    supplier.id,
                    supplier.supplier_code,
                    supplier.legal_name,
                    supplier.category,
                    supplier.country,

                    latest_risk.overall_score,
                    latest_risk.risk_band,
                    latest_risk.recommendation,
                    latest_risk.spend_exposure

                FROM latest_risk

                JOIN suppliers supplier
                    ON supplier.id =
                       latest_risk.supplier_id

                WHERE supplier.status =
                    'ACTIVE'

                AND latest_risk.risk_band IN (
                    'HIGH',
                    'CRITICAL'
                )

                ORDER BY
                    latest_risk.overall_score DESC,
                    latest_risk.spend_exposure DESC,
                    supplier.legal_name

                LIMIT 10
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SupplierRiskSnapshotRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "supplier_code"
                                ),
                                resultSet.getString(
                                        "legal_name"
                                ),
                                resultSet.getString(
                                        "category"
                                ),
                                resultSet.getString(
                                        "country"
                                ),
                                resultSet.getBigDecimal(
                                        "overall_score"
                                ),
                                resultSet.getString(
                                        "risk_band"
                                ),
                                resultSet.getString(
                                        "recommendation"
                                ),
                                resultSet.getBigDecimal(
                                        "spend_exposure"
                                )
                        ),
                currency
        );
    }

    public List<CategorySnapshotRow> categorySnapshot(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    strategy.id,
                    strategy.strategy_code,
                    strategy.category_name,
                    strategy.matrix_position,
                    strategy.strategic_value_score,
                    strategy.supply_risk_score,
                    strategy.savings_target_amount,
                    strategy.realized_savings

                FROM (
                    SELECT
                        strategy.*,

                        COALESCE(
                            (
                                SELECT SUM(
                                    initiative.realized_savings
                                )

                                FROM procurement_category_initiatives
                                    initiative

                                WHERE
                                    initiative.strategy_id =
                                        strategy.id
                            ),
                            0
                        )
                            AS realized_savings

                    FROM procurement_category_strategies
                        strategy

                    WHERE strategy.currency = ?

                    AND strategy.status IN (
                        'ACTIVE',
                        'ON_HOLD'
                    )
                )
                    strategy

                ORDER BY
                    CASE strategy.matrix_position
                        WHEN 'CRITICAL_PRIORITY'
                        THEN 1
                        WHEN 'RISK_MITIGATION'
                        THEN 2
                        WHEN 'VALUE_OPTIMIZATION'
                        THEN 3
                        ELSE 4
                    END,
                    strategy.supply_risk_score DESC,
                    strategy.savings_target_amount DESC

                LIMIT 10
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CategorySnapshotRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "strategy_code"
                                ),
                                resultSet.getString(
                                        "category_name"
                                ),
                                resultSet.getString(
                                        "matrix_position"
                                ),
                                resultSet.getBigDecimal(
                                        "strategic_value_score"
                                ),
                                resultSet.getBigDecimal(
                                        "supply_risk_score"
                                ),
                                resultSet.getBigDecimal(
                                        "savings_target_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "realized_savings"
                                )
                        ),
                currency
        );
    }

    public List<BenefitPortfolioSnapshotRow> benefitPortfolioSnapshot(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    portfolio.id,
                    portfolio.portfolio_number,
                    portfolio.source_scenario_name,
                    portfolio.status,
                    portfolio.baseline_target_savings,

                    COALESCE(
                        benefit.forecast_savings,
                        0
                    )
                        AS forecast_savings,

                    COALESCE(
                        benefit.validated_savings,
                        0
                    )
                        AS validated_savings,

                    COALESCE(
                        leakage.active_leakage_amount,
                        0
                    )
                        AS active_leakage_amount,

                    GREATEST(
                        portfolio.baseline_target_savings
                        -
                        COALESCE(
                            benefit.forecast_savings,
                            0
                        ),
                        0
                    )
                    +
                    COALESCE(
                        leakage.active_leakage_amount,
                        0
                    )
                        AS at_risk_amount

                FROM procurement_execution_portfolios
                    portfolio

                LEFT JOIN LATERAL (
                    SELECT
                        SUM(
                            item.forecast_savings
                        )
                        FILTER (
                            WHERE
                                item.status
                                    <> 'CANCELLED'
                        )
                            AS forecast_savings,

                        SUM(
                            item.validated_savings
                        )
                            AS validated_savings

                    FROM procurement_benefit_items
                        item

                    WHERE
                        item.portfolio_id =
                            portfolio.id
                )
                    benefit
                    ON TRUE

                LEFT JOIN LATERAL (
                    SELECT
                        SUM(
                            leakage.amount
                        )
                        FILTER (
                            WHERE
                                leakage.status IN (
                                    'OPEN',
                                    'ACCEPTED'
                                )
                        )
                            AS active_leakage_amount

                    FROM procurement_benefit_leakage
                        leakage

                    JOIN procurement_benefit_items
                        item
                        ON item.id =
                           leakage.benefit_item_id

                    WHERE
                        item.portfolio_id =
                            portfolio.id
                )
                    leakage
                    ON TRUE

                WHERE portfolio.currency = ?

                AND portfolio.status
                    <> 'ARCHIVED'

                ORDER BY
                    at_risk_amount DESC,
                    portfolio.baseline_target_savings DESC

                LIMIT 10
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new BenefitPortfolioSnapshotRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "portfolio_number"
                                ),
                                resultSet.getString(
                                        "source_scenario_name"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_target_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "forecast_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "validated_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "active_leakage_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "at_risk_amount"
                                )
                        ),
                currency
        );
    }

    public void insertSnapshot(
            UUID reviewId,
            SnapshotMetricsRow metrics
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_governance_review_snapshots (
                    review_id,
                    evaluated_suppliers,
                    high_risk_suppliers,
                    critical_risk_suppliers,
                    spend_at_high_risk,
                    active_risk_alerts,
                    open_risk_escalations,
                    active_category_strategies,
                    active_category_initiatives,
                    overdue_category_initiatives,
                    approved_scenarios,
                    active_execution_portfolios,
                    baseline_target_savings,
                    forecast_savings,
                    operational_reported_savings,
                    validated_savings,
                    validation_pending_items,
                    active_leakage_cases,
                    active_leakage_amount,
                    at_risk_amount,
                    active_assumptions,
                    invalidated_assumptions,
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
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                reviewId,
                metrics.evaluatedSuppliers(),
                metrics.highRiskSuppliers(),
                metrics.criticalRiskSuppliers(),
                metrics.spendAtHighRisk(),
                metrics.activeRiskAlerts(),
                metrics.openRiskEscalations(),
                metrics.activeCategoryStrategies(),
                metrics.activeCategoryInitiatives(),
                metrics.overdueCategoryInitiatives(),
                metrics.approvedScenarios(),
                metrics.activeExecutionPortfolios(),
                metrics.baselineTargetSavings(),
                metrics.forecastSavings(),
                metrics.operationalReportedSavings(),
                metrics.validatedSavings(),
                metrics.validationPendingItems(),
                metrics.activeLeakageCases(),
                metrics.activeLeakageAmount(),
                metrics.atRiskAmount(),
                metrics.activeAssumptions(),
                metrics.invalidatedAssumptions()
        );
    }

    public void insertSnapshotItem(
            UUID reviewId,
            GovernanceSnapshotItemType itemType,
            String itemKey,
            int rankPosition,
            GovernanceSeverity severity,
            String title,
            String subtitle,
            String metricLabel,
            BigDecimal metricValue,
            String currency,
            String details
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_governance_snapshot_items (
                    id,
                    review_id,
                    item_type,
                    item_key,
                    rank_position,
                    severity,
                    title,
                    subtitle,
                    metric_label,
                    metric_value,
                    currency,
                    details,
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
                UUID.randomUUID(),
                reviewId,
                itemType.name(),
                itemKey,
                rankPosition,
                severity.name(),
                title,
                normalizeOptional(
                        subtitle
                ),
                metricLabel,
                metricValue,
                currency,
                details
        );
    }

    public SnapshotMetricsPersistedRow snapshot(
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    review_id,
                    evaluated_suppliers,
                    high_risk_suppliers,
                    critical_risk_suppliers,
                    spend_at_high_risk,
                    active_risk_alerts,
                    open_risk_escalations,
                    active_category_strategies,
                    active_category_initiatives,
                    overdue_category_initiatives,
                    approved_scenarios,
                    active_execution_portfolios,
                    baseline_target_savings,
                    forecast_savings,
                    operational_reported_savings,
                    validated_savings,
                    validation_pending_items,
                    active_leakage_cases,
                    active_leakage_amount,
                    at_risk_amount,
                    active_assumptions,
                    invalidated_assumptions,
                    captured_at

                FROM procurement_governance_review_snapshots

                WHERE review_id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotMetricsPersistedRow(
                                resultSet.getObject(
                                        "review_id",
                                        UUID.class
                                ),
                                resultSet.getLong(
                                        "evaluated_suppliers"
                                ),
                                resultSet.getLong(
                                        "high_risk_suppliers"
                                ),
                                resultSet.getLong(
                                        "critical_risk_suppliers"
                                ),
                                resultSet.getBigDecimal(
                                        "spend_at_high_risk"
                                ),
                                resultSet.getLong(
                                        "active_risk_alerts"
                                ),
                                resultSet.getLong(
                                        "open_risk_escalations"
                                ),
                                resultSet.getLong(
                                        "active_category_strategies"
                                ),
                                resultSet.getLong(
                                        "active_category_initiatives"
                                ),
                                resultSet.getLong(
                                        "overdue_category_initiatives"
                                ),
                                resultSet.getLong(
                                        "approved_scenarios"
                                ),
                                resultSet.getLong(
                                        "active_execution_portfolios"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_target_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "forecast_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "operational_reported_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "validated_savings"
                                ),
                                resultSet.getLong(
                                        "validation_pending_items"
                                ),
                                resultSet.getLong(
                                        "active_leakage_cases"
                                ),
                                resultSet.getBigDecimal(
                                        "active_leakage_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "at_risk_amount"
                                ),
                                resultSet.getLong(
                                        "active_assumptions"
                                ),
                                resultSet.getLong(
                                        "invalidated_assumptions"
                                ),
                                resultSet.getTimestamp(
                                        "captured_at"
                                )
                                        .toInstant()
                        ),
                reviewId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<SnapshotItemRow> snapshotItems(
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    item_type,
                    item_key,
                    rank_position,
                    severity,
                    title,
                    subtitle,
                    metric_label,
                    metric_value,
                    currency,
                    details

                FROM procurement_governance_snapshot_items

                WHERE review_id = ?

                ORDER BY
                    CASE item_type
                        WHEN 'SUPPLIER_RISK'
                        THEN 1
                        WHEN 'CATEGORY_STRATEGY'
                        THEN 2
                        ELSE 3
                    END,
                    rank_position
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SnapshotItemRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                GovernanceSnapshotItemType.valueOf(
                                        resultSet.getString(
                                                "item_type"
                                        )
                                ),
                                resultSet.getString(
                                        "item_key"
                                ),
                                resultSet.getInt(
                                        "rank_position"
                                ),
                                GovernanceSeverity.valueOf(
                                        resultSet.getString(
                                                "severity"
                                        )
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "subtitle"
                                ),
                                resultSet.getString(
                                        "metric_label"
                                ),
                                resultSet.getBigDecimal(
                                        "metric_value"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getString(
                                        "details"
                                )
                        ),
                reviewId
        );
    }

    public void freezeReview(
            UUID reviewId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_governance_reviews
                SET
                    status =
                        'FROZEN',
                    frozen_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'DRAFT'
                """,
                reviewId
        );
    }

    public void openReview(
            UUID reviewId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_governance_reviews
                SET
                    status =
                        'IN_REVIEW',
                    opened_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'FROZEN'
                """,
                reviewId
        );
    }

    public void closeReview(
            UUID reviewId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_governance_reviews
                SET
                    status =
                        'CLOSED',
                    closed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'IN_REVIEW'
                """,
                reviewId
        );
    }

    public void archiveReview(
            UUID reviewId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_governance_reviews
                SET
                    status =
                        'ARCHIVED',
                    archived_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'CLOSED'
                """,
                reviewId
        );
    }

    public void createDecision(
            UUID decisionId,
            String decisionNumber,
            UUID reviewId,
            GovernanceDecisionInput input,
            UUID requesterUserId,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_governance_decisions (
                    id,
                    decision_number,
                    review_id,
                    decision_type,
                    title,
                    description,
                    status,
                    requested_by_user_id,
                    decision_owner_user_id,
                    due_date,
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
                    'OPEN',
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                decisionId,
                decisionNumber,
                reviewId,
                input.decisionType()
                        .name(),
                input.title()
                        .trim(),
                input.description()
                        .trim(),
                requesterUserId,
                ownerUserId,
                input.dueDate()
        );
    }

    public DecisionRow findDecision(
            UUID decisionId
    ) {
        return jdbcTemplate.query(
                decisionSql()
                        + """
                        WHERE decision.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDecision(
                                resultSet
                        ),
                decisionId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<DecisionRow> decisions(
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                decisionSql()
                        + """
                        WHERE decision.review_id = ?

                        ORDER BY
                            CASE decision.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'DEFERRED'
                                THEN 2
                                ELSE 3
                            END,
                            decision.due_date NULLS LAST,
                            decision.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDecision(
                                resultSet
                        ),
                reviewId
        );
    }

    public void resolveDecision(
            UUID decisionId,
            GovernanceDecisionStatus status,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_governance_decisions
                SET
                    status = ?,
                    decision_note = ?,
                    decided_by_user_id = ?,
                    decided_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'OPEN'
                """,
                status.name(),
                note.trim(),
                currentUserId,
                decisionId
        );
    }

    public void createAction(
            UUID actionId,
            String actionNumber,
            UUID reviewId,
            GovernanceActionInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_governance_actions (
                    id,
                    action_number,
                    review_id,
                    decision_id,
                    title,
                    description,
                    owner_user_id,
                    priority,
                    due_date,
                    status,
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
                    'OPEN',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                actionId,
                actionNumber,
                reviewId,
                input.decisionId(),
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                ownerUserId,
                input.priority()
                        .name(),
                input.dueDate()
        );
    }

    public ActionRow findAction(
            UUID actionId
    ) {
        return jdbcTemplate.query(
                actionSql()
                        + """
                        WHERE action.id = ?
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
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                actionSql()
                        + """
                        WHERE action.review_id = ?

                        ORDER BY
                            CASE action.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'IN_PROGRESS'
                                THEN 2
                                ELSE 3
                            END,

                            CASE action.priority
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                WHEN 'MEDIUM'
                                THEN 3
                                ELSE 4
                            END,

                            action.due_date
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAction(
                                resultSet
                        ),
                reviewId
        );
    }

    public void startAction(
            UUID actionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_governance_actions
                SET
                    status =
                        'IN_PROGRESS',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'OPEN'
                """,
                actionId
        );
    }

    public void completeAction(
            UUID actionId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_governance_actions
                SET
                    status =
                        'COMPLETED',
                    completion_note = ?,
                    completed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'OPEN',
                    'IN_PROGRESS'
                )
                """,
                note.trim(),
                actionId
        );
    }

    public void cancelAction(
            UUID actionId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_governance_actions
                SET
                    status =
                        'CANCELLED',
                    completion_note = ?,
                    completed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'OPEN',
                    'IN_PROGRESS'
                )
                """,
                note.trim(),
                actionId
        );
    }

    public List<GovernanceReviewUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role

                FROM app_users

                WHERE active =
                    TRUE

                ORDER BY
                    full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new GovernanceReviewUserOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "full_name"
                                ),
                                ProcurementRole.valueOf(
                                        resultSet.getString(
                                                "role"
                                        )
                                )
                        )
        );
    }

    private String reviewSql() {
        return """
                SELECT
                    review.id,
                    review.review_number,
                    review.title,
                    review.period_start,
                    review.period_end,
                    review.currency,
                    review.status,
                    review.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    review.chair_user_id,

                    chair.full_name
                        AS chair_name,

                    review.executive_summary,

                    COALESCE(
                        snapshot.baseline_target_savings,
                        0
                    )
                        AS snapshot_target_savings,

                    COALESCE(
                        snapshot.validated_savings,
                        0
                    )
                        AS snapshot_validated_savings,

                    COALESCE(
                        snapshot.at_risk_amount,
                        0
                    )
                        AS snapshot_at_risk_amount,

                    COALESCE(
                        snapshot.critical_risk_suppliers,
                        0
                    )
                        AS snapshot_critical_suppliers,

                    COALESCE(
                        decision_stats.open_decisions,
                        0
                    )
                        AS open_decisions,

                    COALESCE(
                        action_stats.open_actions,
                        0
                    )
                        AS open_actions,

                    COALESCE(
                        action_stats.overdue_actions,
                        0
                    )
                        AS overdue_actions,

                    review.frozen_at,
                    review.opened_at,
                    review.closed_at,
                    review.archived_at,
                    review.created_at,
                    review.updated_at,
                    review.version

                FROM procurement_governance_reviews
                    review

                JOIN app_users owner
                    ON owner.id =
                       review.owner_user_id

                JOIN app_users chair
                    ON chair.id =
                       review.chair_user_id

                LEFT JOIN procurement_governance_review_snapshots
                    snapshot
                    ON snapshot.review_id =
                       review.id

                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(*)
                        FILTER (
                            WHERE
                                decision.status =
                                    'OPEN'
                        )
                            AS open_decisions

                    FROM procurement_governance_decisions
                        decision

                    WHERE
                        decision.review_id =
                            review.id
                )
                    decision_stats
                    ON TRUE

                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(*)
                        FILTER (
                            WHERE
                                action.status IN (
                                    'OPEN',
                                    'IN_PROGRESS'
                                )
                        )
                            AS open_actions,

                        COUNT(*)
                        FILTER (
                            WHERE
                                action.status IN (
                                    'OPEN',
                                    'IN_PROGRESS'
                                )
                            AND action.due_date
                                < CURRENT_DATE
                        )
                            AS overdue_actions

                    FROM procurement_governance_actions
                        action

                    WHERE
                        action.review_id =
                            review.id
                )
                    action_stats
                    ON TRUE

                """;
    }

    private String decisionSql() {
        return """
                SELECT
                    decision.id,
                    decision.decision_number,
                    decision.review_id,
                    decision.decision_type,
                    decision.title,
                    decision.description,
                    decision.status,

                    requester.full_name
                        AS requested_by_name,

                    decision.decision_owner_user_id,

                    decision_owner.full_name
                        AS decision_owner_name,

                    decision.due_date,
                    decision.decision_note,

                    decider.full_name
                        AS decided_by_name,

                    decision.decided_at,
                    decision.created_at,
                    decision.updated_at,
                    decision.version

                FROM procurement_governance_decisions
                    decision

                JOIN app_users requester
                    ON requester.id =
                       decision.requested_by_user_id

                JOIN app_users decision_owner
                    ON decision_owner.id =
                       decision.decision_owner_user_id

                LEFT JOIN app_users decider
                    ON decider.id =
                       decision.decided_by_user_id

                """;
    }

    private String actionSql() {
        return """
                SELECT
                    action.id,
                    action.action_number,
                    action.review_id,
                    action.decision_id,
                    action.title,
                    action.description,
                    action.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    action.priority,
                    action.due_date,
                    action.status,
                    action.completion_note,
                    action.completed_at,
                    action.created_at,
                    action.updated_at,
                    action.version

                FROM procurement_governance_actions
                    action

                JOIN app_users owner
                    ON owner.id =
                       action.owner_user_id

                """;
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
                resultSet.getString(
                        "title"
                ),
                resultSet.getObject(
                        "period_start",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "period_end",
                        LocalDate.class
                ),
                resultSet.getString(
                        "currency"
                ),
                GovernanceReviewStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getObject(
                        "chair_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "chair_name"
                ),
                resultSet.getString(
                        "executive_summary"
                ),
                resultSet.getBigDecimal(
                        "snapshot_target_savings"
                ),
                resultSet.getBigDecimal(
                        "snapshot_validated_savings"
                ),
                resultSet.getBigDecimal(
                        "snapshot_at_risk_amount"
                ),
                resultSet.getLong(
                        "snapshot_critical_suppliers"
                ),
                resultSet.getLong(
                        "open_decisions"
                ),
                resultSet.getLong(
                        "open_actions"
                ),
                resultSet.getLong(
                        "overdue_actions"
                ),
                instant(
                        resultSet,
                        "frozen_at"
                ),
                instant(
                        resultSet,
                        "opened_at"
                ),
                instant(
                        resultSet,
                        "closed_at"
                ),
                instant(
                        resultSet,
                        "archived_at"
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

    private DecisionRow mapDecision(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new DecisionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "decision_number"
                ),
                resultSet.getObject(
                        "review_id",
                        UUID.class
                ),
                GovernanceDecisionType.valueOf(
                        resultSet.getString(
                                "decision_type"
                        )
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
                ),
                GovernanceDecisionStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "requested_by_name"
                ),
                resultSet.getObject(
                        "decision_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "decision_owner_name"
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                resultSet.getString(
                        "decision_note"
                ),
                resultSet.getString(
                        "decided_by_name"
                ),
                instant(
                        resultSet,
                        "decided_at"
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
                resultSet.getString(
                        "action_number"
                ),
                resultSet.getObject(
                        "review_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "decision_id",
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
                        "owner_name"
                ),
                GovernanceActionPriority.valueOf(
                        resultSet.getString(
                                "priority"
                        )
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                GovernanceActionStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "completion_note"
                ),
                instant(
                        resultSet,
                        "completed_at"
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

    public record ReviewRow(
            UUID id,
            String reviewNumber,
            String title,
            LocalDate periodStart,
            LocalDate periodEnd,
            String currency,
            GovernanceReviewStatus status,
            UUID ownerUserId,
            String ownerName,
            UUID chairUserId,
            String chairName,
            String executiveSummary,
            BigDecimal snapshotTargetSavings,
            BigDecimal snapshotValidatedSavings,
            BigDecimal snapshotAtRiskAmount,
            long snapshotCriticalSuppliers,
            long openDecisions,
            long openActions,
            long overdueActions,
            Instant frozenAt,
            Instant openedAt,
            Instant closedAt,
            Instant archivedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record SnapshotMetricsRow(
            long evaluatedSuppliers,
            long highRiskSuppliers,
            long criticalRiskSuppliers,
            BigDecimal spendAtHighRisk,
            long activeRiskAlerts,
            long openRiskEscalations,
            long activeCategoryStrategies,
            long activeCategoryInitiatives,
            long overdueCategoryInitiatives,
            long approvedScenarios,
            long activeExecutionPortfolios,
            BigDecimal baselineTargetSavings,
            BigDecimal forecastSavings,
            BigDecimal operationalReportedSavings,
            BigDecimal validatedSavings,
            long validationPendingItems,
            long activeLeakageCases,
            BigDecimal activeLeakageAmount,
            BigDecimal atRiskAmount,
            long activeAssumptions,
            long invalidatedAssumptions
    ) {
    }

    public record SnapshotMetricsPersistedRow(
            UUID reviewId,
            long evaluatedSuppliers,
            long highRiskSuppliers,
            long criticalRiskSuppliers,
            BigDecimal spendAtHighRisk,
            long activeRiskAlerts,
            long openRiskEscalations,
            long activeCategoryStrategies,
            long activeCategoryInitiatives,
            long overdueCategoryInitiatives,
            long approvedScenarios,
            long activeExecutionPortfolios,
            BigDecimal baselineTargetSavings,
            BigDecimal forecastSavings,
            BigDecimal operationalReportedSavings,
            BigDecimal validatedSavings,
            long validationPendingItems,
            long activeLeakageCases,
            BigDecimal activeLeakageAmount,
            BigDecimal atRiskAmount,
            long activeAssumptions,
            long invalidatedAssumptions,
            Instant capturedAt
    ) {
    }

    public record SupplierRiskSnapshotRow(
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String category,
            String country,
            BigDecimal score,
            String riskBand,
            String recommendation,
            BigDecimal spendExposure
    ) {
    }

    public record CategorySnapshotRow(
            UUID strategyId,
            String strategyCode,
            String categoryName,
            String matrixPosition,
            BigDecimal strategicValueScore,
            BigDecimal supplyRiskScore,
            BigDecimal targetSavings,
            BigDecimal realizedSavings
    ) {
    }

    public record BenefitPortfolioSnapshotRow(
            UUID portfolioId,
            String portfolioNumber,
            String scenarioName,
            String status,
            BigDecimal targetSavings,
            BigDecimal forecastSavings,
            BigDecimal validatedSavings,
            BigDecimal leakageAmount,
            BigDecimal atRiskAmount
    ) {
    }

    public record SnapshotItemRow(
            UUID id,
            GovernanceSnapshotItemType itemType,
            String itemKey,
            int rankPosition,
            GovernanceSeverity severity,
            String title,
            String subtitle,
            String metricLabel,
            BigDecimal metricValue,
            String currency,
            String details
    ) {
    }

    public record DecisionRow(
            UUID id,
            String decisionNumber,
            UUID reviewId,
            GovernanceDecisionType decisionType,
            String title,
            String description,
            GovernanceDecisionStatus status,
            String requestedByName,
            UUID decisionOwnerUserId,
            String decisionOwnerName,
            LocalDate dueDate,
            String decisionNote,
            String decidedByName,
            Instant decidedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ActionRow(
            UUID id,
            String actionNumber,
            UUID reviewId,
            UUID decisionId,
            String title,
            String description,
            UUID ownerUserId,
            String ownerName,
            GovernanceActionPriority priority,
            LocalDate dueDate,
            GovernanceActionStatus status,
            String completionNote,
            Instant completedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }
}
