package com.procureiq.categorymanagement;

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
public class CategoryManagementRepository {

    private final JdbcTemplate jdbcTemplate;

    public CategoryManagementRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextStrategySequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_category_strategy_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextInitiativeSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_category_initiative_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<CategoryInsightRow> categoryInsights(
            String currency
    ) {
        return jdbcTemplate.query(
                categoryInsightSql(),
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CategoryInsightRow(
                                resultSet.getString(
                                        "category_name"
                                ),
                                resultSet.getLong(
                                        "supplier_count"
                                ),
                                resultSet.getBigDecimal(
                                        "total_spend"
                                ),
                                resultSet.getBigDecimal(
                                        "top_supplier_share"
                                ),
                                resultSet.getLong(
                                        "high_risk_suppliers"
                                ),
                                resultSet.getBigDecimal(
                                        "weighted_risk_score"
                                )
                        ),
                currency,
                currency
        );
    }

    public CategoryInsightRow categoryInsight(
            String categoryName,
            String currency
    ) {
        return categoryInsights(
                currency
        )
                .stream()
                .filter(
                        insight ->
                                insight.categoryName()
                                        .equalsIgnoreCase(
                                                categoryName
                                        )
                )
                .findFirst()
                .orElse(null);
    }

    public List<SupplierLandscapeRow> supplierLandscape(
            String categoryName,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                WITH po_spend AS (
                    SELECT
                        supplier_id,

                        SUM(
                            total_amount
                        )
                            AS spend

                    FROM purchase_orders

                    WHERE currency = ?

                    AND status
                        <> 'CANCELLED'

                    GROUP BY
                        supplier_id
                ),

                latest_risk AS (
                    SELECT DISTINCT ON (
                        supplier_id
                    )
                        supplier_id,
                        overall_score,
                        risk_band

                    FROM supplier_risk_evaluations

                    WHERE currency = ?

                    ORDER BY
                        supplier_id,
                        evaluated_at DESC
                ),

                supplier_view AS (
                    SELECT
                        supplier.id,
                        supplier.supplier_code,
                        supplier.legal_name,
                        supplier.country,

                        COALESCE(
                            NULLIF(
                                BTRIM(
                                    supplier.category
                                ),
                                ''
                            ),
                            'Uncategorized'
                        )
                            AS category_name,

                        COALESCE(
                            po_spend.spend,
                            0
                        )
                            AS spend,

                        latest_risk.overall_score,
                        latest_risk.risk_band

                    FROM suppliers supplier

                    LEFT JOIN po_spend
                        ON po_spend.supplier_id =
                           supplier.id

                    LEFT JOIN latest_risk
                        ON latest_risk.supplier_id =
                           supplier.id

                    WHERE supplier.status =
                        'ACTIVE'
                ),

                scoped AS (
                    SELECT *
                    FROM supplier_view
                    WHERE LOWER(
                        category_name
                    )
                    =
                    LOWER(?)
                ),

                total AS (
                    SELECT
                        COALESCE(
                            SUM(
                                spend
                            ),
                            0
                        )
                            AS total_spend
                    FROM scoped
                )

                SELECT
                    scoped.id,
                    scoped.supplier_code,
                    scoped.legal_name,
                    scoped.country,
                    scoped.spend,

                    CASE
                        WHEN total.total_spend = 0
                        THEN 0
                        ELSE ROUND(
                            (
                                scoped.spend
                                /
                                total.total_spend
                                *
                                100
                            )::NUMERIC,
                            2
                        )
                    END
                        AS spend_share,

                    scoped.overall_score,
                    scoped.risk_band

                FROM scoped

                CROSS JOIN total

                ORDER BY
                    scoped.spend DESC,
                    scoped.legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SupplierLandscapeRow(
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
                                        "country"
                                ),
                                resultSet.getBigDecimal(
                                        "spend"
                                ),
                                resultSet.getBigDecimal(
                                        "spend_share"
                                ),
                                resultSet.getBigDecimal(
                                        "overall_score"
                                ),
                                resultSet.getString(
                                        "risk_band"
                                )
                        ),
                currency,
                currency,
                categoryName
        );
    }

    public void createStrategy(
            UUID strategyId,
            String strategyCode,
            CategoryStrategyInput input,
            String normalizedCategory,
            String currency,
            UUID ownerUserId,
            BigDecimal spendBaseline,
            BigDecimal modeledOpportunityAmount,
            BigDecimal savingsTargetAmount,
            BigDecimal strategicValueScore,
            BigDecimal supplyRiskScore,
            CategoryMatrixPosition matrixPosition
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_category_strategies (
                    id,
                    strategy_code,
                    category_name,
                    currency,
                    fiscal_year,
                    status,
                    owner_user_id,
                    spend_baseline,
                    modeled_opportunity_amount,
                    savings_target_pct,
                    savings_target_amount,
                    strategic_value_score,
                    supply_risk_score,
                    matrix_position,
                    objectives,
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
                    'DRAFT',
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
                strategyId,
                strategyCode,
                normalizedCategory,
                currency,
                input.fiscalYear(),
                ownerUserId,
                spendBaseline,
                modeledOpportunityAmount,
                input.savingsTargetPct(),
                savingsTargetAmount,
                strategicValueScore,
                supplyRiskScore,
                matrixPosition.name(),
                input.objectives()
                        .trim()
        );
    }

    public StrategyRow findStrategy(
            UUID strategyId
    ) {
        return jdbcTemplate.query(
                strategySql()
                        + """
                        WHERE strategy.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapStrategy(
                                resultSet
                        ),
                strategyId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<StrategyRow> strategies(
            String currency
    ) {
        return jdbcTemplate.query(
                strategySql()
                        + """
                        WHERE strategy.currency = ?

                        ORDER BY
                            CASE strategy.status
                                WHEN 'ACTIVE'
                                THEN 1
                                WHEN 'DRAFT'
                                THEN 2
                                WHEN 'ON_HOLD'
                                THEN 3
                                WHEN 'CLOSED'
                                THEN 4
                                ELSE 5
                            END,
                            strategy.fiscal_year DESC,
                            strategy.category_name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapStrategy(
                                resultSet
                        ),
                currency
        );
    }

    public void updateStrategyStatus(
            UUID strategyId,
            CategoryStrategyStatus status
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_category_strategies
                SET
                    status = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                status.name(),
                strategyId
        );
    }

    public void createInitiative(
            UUID initiativeId,
            String initiativeNumber,
            UUID strategyId,
            CategoryInitiativeInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_category_initiatives (
                    id,
                    strategy_id,
                    initiative_number,
                    initiative_type,
                    title,
                    description,
                    priority,
                    status,
                    owner_user_id,
                    planned_start_date,
                    planned_end_date,
                    estimated_value,
                    target_savings,
                    realized_savings,
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
                    ?,
                    ?,
                    ?,
                    ?,
                    0,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                initiativeId,
                strategyId,
                initiativeNumber,
                input.initiativeType()
                        .name(),
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                input.priority()
                        .name(),
                ownerUserId,
                input.plannedStartDate(),
                input.plannedEndDate(),
                input.estimatedValue(),
                input.targetSavings()
        );
    }

    public InitiativeRow findInitiative(
            UUID initiativeId
    ) {
        return jdbcTemplate.query(
                initiativeSql()
                        + """
                        WHERE initiative.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapInitiative(
                                resultSet
                        ),
                initiativeId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<InitiativeRow> initiatives(
            UUID strategyId
    ) {
        return jdbcTemplate.query(
                initiativeSql()
                        + """
                        WHERE initiative.strategy_id = ?

                        ORDER BY
                            CASE initiative.status
                                WHEN 'IN_PROGRESS'
                                THEN 1
                                WHEN 'READY'
                                THEN 2
                                WHEN 'PLANNED'
                                THEN 3
                                WHEN 'COMPLETED'
                                THEN 4
                                ELSE 5
                            END,

                            CASE initiative.priority
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                WHEN 'MEDIUM'
                                THEN 3
                                ELSE 4
                            END,

                            initiative.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapInitiative(
                                resultSet
                        ),
                strategyId
        );
    }

    public void updateInitiativeStatus(
            UUID initiativeId,
            CategoryInitiativeStatus status
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_category_initiatives
                SET
                    status = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                status.name(),
                initiativeId
        );
    }

    public void completeInitiative(
            UUID initiativeId,
            BigDecimal realizedSavings
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_category_initiatives
                SET
                    status =
                        'COMPLETED',
                    realized_savings = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                realizedSavings,
                initiativeId
        );
    }

    public void createMilestone(
            UUID milestoneId,
            UUID initiativeId,
            CategoryMilestoneInput input
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_category_milestones (
                    id,
                    initiative_id,
                    title,
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
                    'OPEN',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                milestoneId,
                initiativeId,
                input.title()
                        .trim(),
                input.dueDate()
        );
    }

    public MilestoneRow findMilestone(
            UUID milestoneId
    ) {
        return jdbcTemplate.query(
                milestoneSql()
                        + """
                        WHERE milestone.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapMilestone(
                                resultSet
                        ),
                milestoneId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<MilestoneRow> milestones(
            UUID initiativeId
    ) {
        return jdbcTemplate.query(
                milestoneSql()
                        + """
                        WHERE milestone.initiative_id = ?

                        ORDER BY
                            CASE milestone.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'COMPLETED'
                                THEN 2
                                ELSE 3
                            END,
                            milestone.due_date
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapMilestone(
                                resultSet
                        ),
                initiativeId
        );
    }

    public void completeMilestone(
            UUID milestoneId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_category_milestones
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
                AND status =
                    'OPEN'
                """,
                note.trim(),
                milestoneId
        );
    }

    public void cancelMilestone(
            UUID milestoneId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_category_milestones
                SET
                    status =
                        'CANCELLED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'OPEN'
                """,
                milestoneId
        );
    }

    public List<CategoryUserOptionResponse> users() {
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
                        new CategoryUserOptionResponse(
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

    private String categoryInsightSql() {
        return """
                WITH po_spend AS (
                    SELECT
                        supplier_id,

                        SUM(
                            total_amount
                        )
                            AS spend

                    FROM purchase_orders

                    WHERE currency = ?

                    AND status
                        <> 'CANCELLED'

                    GROUP BY
                        supplier_id
                ),

                latest_risk AS (
                    SELECT DISTINCT ON (
                        supplier_id
                    )
                        supplier_id,
                        overall_score,
                        risk_band

                    FROM supplier_risk_evaluations

                    WHERE currency = ?

                    ORDER BY
                        supplier_id,
                        evaluated_at DESC
                ),

                supplier_view AS (
                    SELECT
                        supplier.id,

                        COALESCE(
                            NULLIF(
                                BTRIM(
                                    supplier.category
                                ),
                                ''
                            ),
                            'Uncategorized'
                        )
                            AS category_name,

                        COALESCE(
                            po_spend.spend,
                            0
                        )
                            AS spend,

                        COALESCE(
                            latest_risk.overall_score,
                            60
                        )
                            AS risk_score,

                        latest_risk.risk_band

                    FROM suppliers supplier

                    LEFT JOIN po_spend
                        ON po_spend.supplier_id =
                           supplier.id

                    LEFT JOIN latest_risk
                        ON latest_risk.supplier_id =
                           supplier.id

                    WHERE supplier.status =
                        'ACTIVE'
                )

                SELECT
                    category_name,

                    COUNT(*)
                        AS supplier_count,

                    COALESCE(
                        SUM(
                            spend
                        ),
                        0
                    )
                        AS total_spend,

                    CASE
                        WHEN COALESCE(
                            SUM(
                                spend
                            ),
                            0
                        ) = 0
                        THEN 0

                        ELSE ROUND(
                            (
                                MAX(
                                    spend
                                )
                                /
                                SUM(
                                    spend
                                )
                                *
                                100
                            )::NUMERIC,
                            2
                        )
                    END
                        AS top_supplier_share,

                    COUNT(*)
                    FILTER (
                        WHERE
                            risk_band IN (
                                'HIGH',
                                'CRITICAL'
                            )
                    )
                        AS high_risk_suppliers,

                    ROUND(
                        (
                            CASE
                                WHEN COALESCE(
                                    SUM(
                                        spend
                                    ),
                                    0
                                ) > 0
                                THEN
                                    SUM(
                                        spend
                                        *
                                        risk_score
                                    )
                                    /
                                    SUM(
                                        spend
                                    )

                                ELSE
                                    AVG(
                                        risk_score
                                    )
                            END
                        )::NUMERIC,
                        2
                    )
                        AS weighted_risk_score

                FROM supplier_view

                GROUP BY
                    category_name

                ORDER BY
                    total_spend DESC,
                    category_name
                """;
    }

    private String strategySql() {
        return """
                SELECT
                    strategy.id,
                    strategy.strategy_code,
                    strategy.category_name,
                    strategy.currency,
                    strategy.fiscal_year,
                    strategy.status,
                    strategy.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    strategy.spend_baseline,

                    COALESCE(
                        current_spend.current_spend,
                        0
                    )
                        AS current_spend,

                    strategy.modeled_opportunity_amount,
                    strategy.savings_target_pct,
                    strategy.savings_target_amount,
                    strategy.strategic_value_score,
                    strategy.supply_risk_score,
                    strategy.matrix_position,
                    strategy.objectives,

                    COALESCE(
                        initiative_stats.initiative_target_savings,
                        0
                    )
                        AS initiative_target_savings,

                    COALESCE(
                        initiative_stats.realized_savings,
                        0
                    )
                        AS realized_savings,

                    COALESCE(
                        initiative_stats.active_initiatives,
                        0
                    )
                        AS active_initiatives,

                    COALESCE(
                        initiative_stats.overdue_initiatives,
                        0
                    )
                        AS overdue_initiatives,

                    COALESCE(
                        milestone_stats.open_milestones,
                        0
                    )
                        AS open_milestones,

                    COALESCE(
                        milestone_stats.overdue_milestones,
                        0
                    )
                        AS overdue_milestones,

                    strategy.created_at,
                    strategy.updated_at,
                    strategy.version

                FROM procurement_category_strategies
                    strategy

                JOIN app_users owner
                    ON owner.id =
                       strategy.owner_user_id

                LEFT JOIN LATERAL (
                    SELECT
                        SUM(
                            purchase_order.total_amount
                        )
                            AS current_spend

                    FROM purchase_orders
                        purchase_order

                    JOIN suppliers supplier
                        ON supplier.id =
                           purchase_order.supplier_id

                    WHERE
                        purchase_order.currency =
                            strategy.currency

                    AND purchase_order.status
                        <> 'CANCELLED'

                    AND LOWER(
                        COALESCE(
                            NULLIF(
                                BTRIM(
                                    supplier.category
                                ),
                                ''
                            ),
                            'Uncategorized'
                        )
                    )
                    =
                    LOWER(
                        strategy.category_name
                    )
                )
                    current_spend
                    ON TRUE

                LEFT JOIN LATERAL (
                    SELECT
                        SUM(
                            initiative.target_savings
                        )
                            AS initiative_target_savings,

                        SUM(
                            initiative.realized_savings
                        )
                            AS realized_savings,

                        COUNT(*)
                        FILTER (
                            WHERE
                                initiative.status IN (
                                    'PLANNED',
                                    'READY',
                                    'IN_PROGRESS'
                                )
                        )
                            AS active_initiatives,

                        COUNT(*)
                        FILTER (
                            WHERE
                                initiative.status IN (
                                    'PLANNED',
                                    'READY',
                                    'IN_PROGRESS'
                                )
                            AND initiative.planned_end_date
                                IS NOT NULL
                            AND initiative.planned_end_date
                                < CURRENT_DATE
                        )
                            AS overdue_initiatives

                    FROM procurement_category_initiatives
                        initiative

                    WHERE
                        initiative.strategy_id =
                            strategy.id
                )
                    initiative_stats
                    ON TRUE

                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(*)
                        FILTER (
                            WHERE
                                milestone.status =
                                    'OPEN'
                        )
                            AS open_milestones,

                        COUNT(*)
                        FILTER (
                            WHERE
                                milestone.status =
                                    'OPEN'
                            AND milestone.due_date
                                < CURRENT_DATE
                        )
                            AS overdue_milestones

                    FROM procurement_category_milestones
                        milestone

                    JOIN procurement_category_initiatives
                        initiative
                        ON initiative.id =
                           milestone.initiative_id

                    WHERE
                        initiative.strategy_id =
                            strategy.id
                )
                    milestone_stats
                    ON TRUE

                """;
    }

    private String initiativeSql() {
        return """
                SELECT
                    initiative.id,
                    initiative.strategy_id,
                    initiative.initiative_number,
                    initiative.initiative_type,
                    initiative.title,
                    initiative.description,
                    initiative.priority,
                    initiative.status,
                    initiative.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    initiative.planned_start_date,
                    initiative.planned_end_date,
                    initiative.estimated_value,
                    initiative.target_savings,
                    initiative.realized_savings,
                    initiative.created_at,
                    initiative.updated_at,
                    initiative.version

                FROM procurement_category_initiatives
                    initiative

                JOIN app_users owner
                    ON owner.id =
                       initiative.owner_user_id

                """;
    }

    private String milestoneSql() {
        return """
                SELECT
                    milestone.id,
                    milestone.initiative_id,
                    milestone.title,
                    milestone.due_date,
                    milestone.status,
                    milestone.completion_note,
                    milestone.completed_at,
                    milestone.created_at,
                    milestone.updated_at,
                    milestone.version

                FROM procurement_category_milestones
                    milestone

                """;
    }

    private StrategyRow mapStrategy(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new StrategyRow(
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
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                CategoryStrategyStatus.valueOf(
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
                resultSet.getBigDecimal(
                        "spend_baseline"
                ),
                resultSet.getBigDecimal(
                        "current_spend"
                ),
                resultSet.getBigDecimal(
                        "modeled_opportunity_amount"
                ),
                resultSet.getBigDecimal(
                        "savings_target_pct"
                ),
                resultSet.getBigDecimal(
                        "savings_target_amount"
                ),
                resultSet.getBigDecimal(
                        "strategic_value_score"
                ),
                resultSet.getBigDecimal(
                        "supply_risk_score"
                ),
                CategoryMatrixPosition.valueOf(
                        resultSet.getString(
                                "matrix_position"
                        )
                ),
                resultSet.getString(
                        "objectives"
                ),
                resultSet.getBigDecimal(
                        "initiative_target_savings"
                ),
                resultSet.getBigDecimal(
                        "realized_savings"
                ),
                resultSet.getLong(
                        "active_initiatives"
                ),
                resultSet.getLong(
                        "overdue_initiatives"
                ),
                resultSet.getLong(
                        "open_milestones"
                ),
                resultSet.getLong(
                        "overdue_milestones"
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

    private InitiativeRow mapInitiative(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new InitiativeRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "strategy_id",
                        UUID.class
                ),
                resultSet.getString(
                        "initiative_number"
                ),
                CategoryInitiativeType.valueOf(
                        resultSet.getString(
                                "initiative_type"
                        )
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
                ),
                CategoryInitiativePriority.valueOf(
                        resultSet.getString(
                                "priority"
                        )
                ),
                CategoryInitiativeStatus.valueOf(
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
                        "planned_start_date",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "planned_end_date",
                        LocalDate.class
                ),
                resultSet.getBigDecimal(
                        "estimated_value"
                ),
                resultSet.getBigDecimal(
                        "target_savings"
                ),
                resultSet.getBigDecimal(
                        "realized_savings"
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

    private MilestoneRow mapMilestone(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp completed =
                resultSet.getTimestamp(
                        "completed_at"
                );

        return new MilestoneRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "initiative_id",
                        UUID.class
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                CategoryMilestoneStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "completion_note"
                ),
                completed == null
                        ? null
                        : completed.toInstant(),
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

    public record CategoryInsightRow(
            String categoryName,
            long supplierCount,
            BigDecimal totalSpend,
            BigDecimal topSupplierShare,
            long highRiskSuppliers,
            BigDecimal weightedRiskScore
    ) {
    }

    public record SupplierLandscapeRow(
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String country,
            BigDecimal spend,
            BigDecimal spendShare,
            BigDecimal riskScore,
            String riskBand
    ) {
    }

    public record StrategyRow(
            UUID id,
            String strategyCode,
            String categoryName,
            String currency,
            int fiscalYear,
            CategoryStrategyStatus status,
            UUID ownerUserId,
            String ownerName,
            BigDecimal spendBaseline,
            BigDecimal currentSpend,
            BigDecimal modeledOpportunityAmount,
            BigDecimal savingsTargetPct,
            BigDecimal savingsTargetAmount,
            BigDecimal strategicValueScore,
            BigDecimal supplyRiskScore,
            CategoryMatrixPosition matrixPosition,
            String objectives,
            BigDecimal initiativeTargetSavings,
            BigDecimal realizedSavings,
            long activeInitiatives,
            long overdueInitiatives,
            long openMilestones,
            long overdueMilestones,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record InitiativeRow(
            UUID id,
            UUID strategyId,
            String initiativeNumber,
            CategoryInitiativeType initiativeType,
            String title,
            String description,
            CategoryInitiativePriority priority,
            CategoryInitiativeStatus status,
            UUID ownerUserId,
            String ownerName,
            LocalDate plannedStartDate,
            LocalDate plannedEndDate,
            BigDecimal estimatedValue,
            BigDecimal targetSavings,
            BigDecimal realizedSavings,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record MilestoneRow(
            UUID id,
            UUID initiativeId,
            String title,
            LocalDate dueDate,
            CategoryMilestoneStatus status,
            String completionNote,
            Instant completedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }
}
