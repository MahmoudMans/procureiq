package com.procureiq.benefitgovernance;

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
public class BenefitsGovernanceRepository {

    private final JdbcTemplate jdbcTemplate;

    public BenefitsGovernanceRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextPortfolioSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_execution_portfolio_number_seq'
                )
                """,
                Long.class
        );
    }

    public ApprovedScenarioRow approvedScenario(
            UUID scenarioId
    ) {
        return jdbcTemplate.query(
                approvedScenarioSql()
                        + """
                        AND scenario.id = ?
                        """ + approvedScenarioGroupBy(),
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapApprovedScenario(
                                resultSet
                        ),
                scenarioId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ApprovedScenarioRow> approvedScenariosAvailable() {
        return jdbcTemplate.query(
                approvedScenarioSql()
                        + """
                        AND NOT EXISTS (
                            SELECT 1
                            FROM procurement_execution_portfolios
                                portfolio
                            WHERE
                                portfolio.source_scenario_id =
                                    scenario.id
                        )
                        """ + approvedScenarioGroupBy() + """
                        ORDER BY
                            scenario.approved_at DESC,
                            scenario.scenario_code
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapApprovedScenario(
                                resultSet
                        )
        );
    }

    public boolean portfolioExistsForScenario(
            UUID scenarioId
    ) {
        Boolean exists =
                jdbcTemplate.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM procurement_execution_portfolios
                            WHERE source_scenario_id = ?
                        )
                        """,
                        Boolean.class,
                        scenarioId
                );

        return Boolean.TRUE.equals(
                exists
        );
    }

    public List<ScenarioSelectedItemRow> selectedScenarioItems(
            UUID scenarioId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    scenario_item.id
                        AS scenario_item_id,

                    scenario_item.initiative_id,

                    initiative.strategy_id,
                    initiative.owner_user_id,

                    scenario_item.category_name,
                    scenario_item.initiative_number,
                    scenario_item.initiative_title,
                    scenario_item.target_savings,

                    initiative.planned_end_date,
                    initiative.realized_savings

                FROM procurement_portfolio_scenario_items
                    scenario_item

                JOIN procurement_category_initiatives
                    initiative
                    ON initiative.id =
                       scenario_item.initiative_id

                WHERE scenario_item.scenario_id = ?

                AND scenario_item.decision =
                    'SELECTED'

                ORDER BY
                    scenario_item.rank_position,
                    scenario_item.initiative_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ScenarioSelectedItemRow(
                                resultSet.getObject(
                                        "scenario_item_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "initiative_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "strategy_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "owner_user_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "category_name"
                                ),
                                resultSet.getString(
                                        "initiative_number"
                                ),
                                resultSet.getString(
                                        "initiative_title"
                                ),
                                resultSet.getBigDecimal(
                                        "target_savings"
                                ),
                                resultSet.getObject(
                                        "planned_end_date",
                                        LocalDate.class
                                ),
                                resultSet.getBigDecimal(
                                        "realized_savings"
                                )
                        ),
                scenarioId
        );
    }

    public void createPortfolio(
            UUID portfolioId,
            String portfolioNumber,
            ApprovedScenarioRow scenario,
            UUID ownerUserId,
            UUID authorizedByUserId,
            String notes
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_execution_portfolios (
                    id,
                    portfolio_number,
                    source_scenario_id,
                    source_scenario_code,
                    source_scenario_name,
                    currency,
                    status,
                    owner_user_id,
                    authorized_by_user_id,
                    authorized_at,
                    baseline_selected_budget,
                    baseline_target_savings,
                    baseline_average_risk,
                    selected_initiative_count,
                    notes,
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
                    'AUTHORIZED',
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
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
                portfolioId,
                portfolioNumber,
                scenario.id(),
                scenario.scenarioCode(),
                scenario.name(),
                scenario.currency(),
                ownerUserId,
                authorizedByUserId,
                scenario.selectedBudget(),
                scenario.targetSavings(),
                scenario.averageRisk(),
                scenario.selectedInitiatives(),
                normalizeOptional(
                        notes
                )
        );
    }

    public void createBenefitItem(
            UUID itemId,
            UUID portfolioId,
            ScenarioSelectedItemRow source
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_benefit_items (
                    id,
                    portfolio_id,
                    scenario_item_id,
                    initiative_id,
                    strategy_id,
                    category_name_snapshot,
                    initiative_number_snapshot,
                    initiative_title_snapshot,
                    benefit_owner_user_id,
                    status,
                    baseline_target_savings,
                    forecast_savings,
                    validated_savings,
                    expected_realization_date,
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
                    'PLANNED',
                    ?,
                    ?,
                    0,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                itemId,
                portfolioId,
                source.scenarioItemId(),
                source.initiativeId(),
                source.strategyId(),
                source.categoryName(),
                source.initiativeNumber(),
                source.initiativeTitle(),
                source.initiativeOwnerUserId(),
                source.targetSavings(),
                source.targetSavings(),
                source.plannedEndDate()
        );
    }

    public PortfolioRow findPortfolio(
            UUID portfolioId
    ) {
        return jdbcTemplate.query(
                portfolioSql()
                        + """
                        WHERE portfolio.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPortfolio(
                                resultSet
                        ),
                portfolioId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<PortfolioRow> portfolios(
            String currency
    ) {
        return jdbcTemplate.query(
                portfolioSql()
                        + """
                        WHERE portfolio.currency = ?

                        ORDER BY
                            CASE portfolio.status
                                WHEN 'IN_EXECUTION'
                                THEN 1
                                WHEN 'AUTHORIZED'
                                THEN 2
                                WHEN 'CLOSED'
                                THEN 3
                                ELSE 4
                            END,

                            portfolio.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPortfolio(
                                resultSet
                        ),
                currency
        );
    }

    public void startPortfolio(
            UUID portfolioId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_execution_portfolios
                SET
                    status =
                        'IN_EXECUTION',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'AUTHORIZED'
                """,
                portfolioId
        );
    }

    public void closePortfolio(
            UUID portfolioId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_execution_portfolios
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
                AND status IN (
                    'AUTHORIZED',
                    'IN_EXECUTION'
                )
                """,
                portfolioId
        );
    }

    public void archivePortfolio(
            UUID portfolioId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_execution_portfolios
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
                portfolioId
        );
    }

    public ItemRow findBenefitItem(
            UUID itemId
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE item.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        ),
                itemId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ItemRow> benefitItems(
            UUID portfolioId
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE item.portfolio_id = ?

                        ORDER BY
                            CASE item.status
                                WHEN 'VALIDATION_PENDING'
                                THEN 1
                                WHEN 'IN_PROGRESS'
                                THEN 2
                                WHEN 'PLANNED'
                                THEN 3
                                WHEN 'VALIDATED'
                                THEN 4
                                ELSE 5
                            END,
                            item.category_name_snapshot,
                            item.initiative_number_snapshot
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        ),
                portfolioId
        );
    }

    public void updateBenefitOwner(
            UUID itemId,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_benefit_items
                SET
                    benefit_owner_user_id = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                ownerUserId,
                itemId
        );
    }

    public void startBenefitItem(
            UUID itemId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_benefit_items
                SET
                    status =
                        'IN_PROGRESS',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'PLANNED'
                """,
                itemId
        );
    }

    public void updateForecast(
            UUID itemId,
            BigDecimal forecastSavings,
            LocalDate expectedRealizationDate
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_benefit_items
                SET
                    forecast_savings = ?,
                    expected_realization_date = ?,
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
                forecastSavings,
                expectedRealizationDate,
                itemId
        );
    }

    public void requestValidation(
            UUID itemId,
            BigDecimal amount,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_benefit_items
                SET
                    status =
                        'VALIDATION_PENDING',
                    validation_requested_amount = ?,
                    validation_request_note = ?,
                    validation_requested_by_user_id = ?,
                    validation_requested_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'IN_PROGRESS'
                """,
                amount,
                note.trim(),
                currentUserId,
                itemId
        );
    }

    public void validateBenefit(
            UUID itemId,
            BigDecimal amount,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_benefit_items
                SET
                    status =
                        'VALIDATED',
                    validated_savings = ?,
                    validated_by_user_id = ?,
                    validation_note = ?,
                    validated_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'VALIDATION_PENDING'
                """,
                amount,
                currentUserId,
                note.trim(),
                itemId
        );
    }

    public void cancelBenefitItem(
            UUID itemId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_benefit_items
                SET
                    status =
                        'CANCELLED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'PLANNED',
                    'IN_PROGRESS',
                    'VALIDATION_PENDING'
                )
                """,
                itemId
        );
    }

    public void createAssumption(
            UUID assumptionId,
            UUID portfolioId,
            BenefitAssumptionInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_benefit_assumptions (
                    id,
                    portfolio_id,
                    assumption_type,
                    description,
                    financial_impact,
                    status,
                    owner_user_id,
                    review_date,
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
                    'ACTIVE',
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                assumptionId,
                portfolioId,
                input.assumptionType()
                        .name(),
                input.description()
                        .trim(),
                input.financialImpact(),
                ownerUserId,
                input.reviewDate()
        );
    }

    public AssumptionRow findAssumption(
            UUID assumptionId
    ) {
        return jdbcTemplate.query(
                assumptionSql()
                        + """
                        WHERE assumption.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAssumption(
                                resultSet
                        ),
                assumptionId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<AssumptionRow> assumptions(
            UUID portfolioId
    ) {
        return jdbcTemplate.query(
                assumptionSql()
                        + """
                        WHERE assumption.portfolio_id = ?

                        ORDER BY
                            CASE assumption.status
                                WHEN 'ACTIVE'
                                THEN 1
                                WHEN 'INVALIDATED'
                                THEN 2
                                ELSE 3
                            END,
                            assumption.review_date NULLS LAST,
                            assumption.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAssumption(
                                resultSet
                        ),
                portfolioId
        );
    }

    public void resolveAssumption(
            UUID assumptionId,
            BenefitAssumptionStatus status,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_benefit_assumptions
                SET
                    status = ?,
                    resolution_note = ?,
                    resolved_by_user_id = ?,
                    resolved_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'ACTIVE'
                """,
                status.name(),
                note.trim(),
                currentUserId,
                assumptionId
        );
    }

    public void createLeakage(
            UUID leakageId,
            UUID benefitItemId,
            BenefitLeakageInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_benefit_leakage (
                    id,
                    benefit_item_id,
                    leakage_type,
                    amount,
                    status,
                    description,
                    owner_user_id,
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
                    'OPEN',
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                leakageId,
                benefitItemId,
                input.leakageType()
                        .name(),
                input.amount(),
                input.description()
                        .trim(),
                ownerUserId,
                input.dueDate()
        );
    }

    public LeakageRow findLeakage(
            UUID leakageId
    ) {
        return jdbcTemplate.query(
                leakageSql()
                        + """
                        WHERE leakage.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapLeakage(
                                resultSet
                        ),
                leakageId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<LeakageRow> leakage(
            UUID portfolioId
    ) {
        return jdbcTemplate.query(
                leakageSql()
                        + """
                        WHERE item.portfolio_id = ?

                        ORDER BY
                            CASE leakage.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'ACCEPTED'
                                THEN 2
                                WHEN 'MITIGATED'
                                THEN 3
                                ELSE 4
                            END,
                            leakage.due_date NULLS LAST,
                            leakage.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapLeakage(
                                resultSet
                        ),
                portfolioId
        );
    }

    public void resolveLeakage(
            UUID leakageId,
            BenefitLeakageStatus status,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_benefit_leakage
                SET
                    status = ?,
                    resolution_note = ?,
                    resolved_by_user_id = ?,
                    resolved_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'OPEN',
                    'ACCEPTED'
                )
                """,
                status.name(),
                note.trim(),
                currentUserId,
                leakageId
        );
    }

    public List<BenefitUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role
                FROM app_users
                WHERE active = TRUE
                ORDER BY
                    full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new BenefitUserOptionResponse(
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

    private String approvedScenarioGroupBy() {
        return """
                GROUP BY
                    scenario.id,
                    owner.full_name

                """;
    }

    private String approvedScenarioSql() {
        return """
                SELECT
                    scenario.id,
                    scenario.scenario_code,
                    scenario.name,
                    scenario.currency,

                    owner.full_name
                        AS owner_name,

                    COUNT(
                        item.id
                    )
                        AS selected_initiatives,

                    COALESCE(
                        SUM(
                            item.estimated_value
                        ),
                        0
                    )
                        AS selected_budget,

                    COALESCE(
                        SUM(
                            item.target_savings
                        ),
                        0
                    )
                        AS target_savings,

                    COALESCE(
                        AVG(
                            item.supply_risk_score
                        ),
                        0
                    )
                        AS average_risk,

                    scenario.approved_at

                FROM procurement_portfolio_scenarios
                    scenario

                JOIN app_users owner
                    ON owner.id =
                       scenario.owner_user_id

                JOIN procurement_portfolio_scenario_items
                    item
                    ON item.scenario_id =
                       scenario.id

                    AND item.decision =
                        'SELECTED'

                WHERE scenario.status =
                    'APPROVED'


                """;
    }

    private String portfolioSql() {
        return """
                SELECT
                    portfolio.id,
                    portfolio.portfolio_number,
                    portfolio.source_scenario_id,
                    portfolio.source_scenario_code,
                    portfolio.source_scenario_name,
                    portfolio.currency,
                    portfolio.status,
                    portfolio.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    authorizer.full_name
                        AS authorized_by_name,

                    portfolio.authorized_at,
                    portfolio.baseline_selected_budget,
                    portfolio.baseline_target_savings,
                    portfolio.baseline_average_risk,
                    portfolio.selected_initiative_count,
                    portfolio.notes,

                    COALESCE(
                        item_stats.current_forecast_savings,
                        0
                    )
                        AS current_forecast_savings,

                    COALESCE(
                        item_stats.operational_reported_savings,
                        0
                    )
                        AS operational_reported_savings,

                    COALESCE(
                        item_stats.validated_savings,
                        0
                    )
                        AS validated_savings,

                    COALESCE(
                        item_stats.active_benefit_items,
                        0
                    )
                        AS active_benefit_items,

                    COALESCE(
                        item_stats.validation_pending_items,
                        0
                    )
                        AS validation_pending_items,

                    COALESCE(
                        item_stats.validated_items,
                        0
                    )
                        AS validated_items,

                    COALESCE(
                        assumption_stats.active_assumptions,
                        0
                    )
                        AS active_assumptions,

                    COALESCE(
                        assumption_stats.invalidated_assumptions,
                        0
                    )
                        AS invalidated_assumptions,

                    COALESCE(
                        leakage_stats.active_leakage_cases,
                        0
                    )
                        AS active_leakage_cases,

                    COALESCE(
                        leakage_stats.active_leakage_amount,
                        0
                    )
                        AS active_leakage_amount,

                    COALESCE(
                        leakage_stats.overdue_leakage_cases,
                        0
                    )
                        AS overdue_leakage_cases,

                    portfolio.closed_at,
                    portfolio.archived_at,
                    portfolio.created_at,
                    portfolio.updated_at,
                    portfolio.version

                FROM procurement_execution_portfolios
                    portfolio

                JOIN app_users owner
                    ON owner.id =
                       portfolio.owner_user_id

                JOIN app_users authorizer
                    ON authorizer.id =
                       portfolio.authorized_by_user_id

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
                            AS current_forecast_savings,

                        SUM(
                            initiative.realized_savings
                        )
                        FILTER (
                            WHERE
                                item.status
                                    <> 'CANCELLED'
                        )
                            AS operational_reported_savings,

                        SUM(
                            item.validated_savings
                        )
                            AS validated_savings,

                        COUNT(*)
                        FILTER (
                            WHERE
                                item.status IN (
                                    'PLANNED',
                                    'IN_PROGRESS',
                                    'VALIDATION_PENDING'
                                )
                        )
                            AS active_benefit_items,

                        COUNT(*)
                        FILTER (
                            WHERE
                                item.status =
                                    'VALIDATION_PENDING'
                        )
                            AS validation_pending_items,

                        COUNT(*)
                        FILTER (
                            WHERE
                                item.status =
                                    'VALIDATED'
                        )
                            AS validated_items

                    FROM procurement_benefit_items
                        item

                    JOIN procurement_category_initiatives
                        initiative
                        ON initiative.id =
                           item.initiative_id

                    WHERE
                        item.portfolio_id =
                            portfolio.id
                )
                    item_stats
                    ON TRUE

                LEFT JOIN LATERAL (
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

                    WHERE
                        assumption.portfolio_id =
                            portfolio.id
                )
                    assumption_stats
                    ON TRUE

                LEFT JOIN LATERAL (
                    SELECT
                        COUNT(*)
                        FILTER (
                            WHERE
                                leakage.status IN (
                                    'OPEN',
                                    'ACCEPTED'
                                )
                        )
                            AS active_leakage_cases,

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
                            AS active_leakage_amount,

                        COUNT(*)
                        FILTER (
                            WHERE
                                leakage.status IN (
                                    'OPEN',
                                    'ACCEPTED'
                                )
                            AND leakage.due_date
                                IS NOT NULL
                            AND leakage.due_date
                                < CURRENT_DATE
                        )
                            AS overdue_leakage_cases

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
                    leakage_stats
                    ON TRUE

                """;
    }

    private String itemSql() {
        return """
                SELECT
                    item.id,
                    item.portfolio_id,
                    item.scenario_item_id,
                    item.initiative_id,
                    item.strategy_id,
                    item.category_name_snapshot,
                    item.initiative_number_snapshot,
                    item.initiative_title_snapshot,
                    item.benefit_owner_user_id,

                    owner.full_name
                        AS benefit_owner_name,

                    item.status,
                    item.baseline_target_savings,
                    item.forecast_savings,

                    initiative.realized_savings
                        AS operational_reported_savings,

                    item.validation_requested_amount,
                    item.validation_request_note,

                    validation_requester.full_name
                        AS validation_requested_by_name,

                    item.validation_requested_at,

                    item.validated_savings,

                    validator.full_name
                        AS validated_by_name,

                    item.validation_note,
                    item.validated_at,
                    item.expected_realization_date,

                    COALESCE(
                        leakage_stats.active_leakage_amount,
                        0
                    )
                        AS active_leakage_amount,

                    item.created_at,
                    item.updated_at,
                    item.version

                FROM procurement_benefit_items
                    item

                JOIN app_users owner
                    ON owner.id =
                       item.benefit_owner_user_id

                JOIN procurement_category_initiatives
                    initiative
                    ON initiative.id =
                       item.initiative_id

                LEFT JOIN app_users
                    validation_requester
                    ON validation_requester.id =
                       item.validation_requested_by_user_id

                LEFT JOIN app_users validator
                    ON validator.id =
                       item.validated_by_user_id

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

                    WHERE
                        leakage.benefit_item_id =
                            item.id
                )
                    leakage_stats
                    ON TRUE

                """;
    }

    private String assumptionSql() {
        return """
                SELECT
                    assumption.id,
                    assumption.portfolio_id,
                    assumption.assumption_type,
                    assumption.description,
                    assumption.financial_impact,
                    assumption.status,
                    assumption.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    assumption.review_date,
                    assumption.resolution_note,

                    resolver.full_name
                        AS resolved_by_name,

                    assumption.resolved_at,
                    assumption.created_at,
                    assumption.updated_at,
                    assumption.version

                FROM procurement_benefit_assumptions
                    assumption

                JOIN app_users owner
                    ON owner.id =
                       assumption.owner_user_id

                LEFT JOIN app_users resolver
                    ON resolver.id =
                       assumption.resolved_by_user_id

                """;
    }

    private String leakageSql() {
        return """
                SELECT
                    leakage.id,
                    leakage.benefit_item_id,

                    item.initiative_number_snapshot,
                    item.initiative_title_snapshot,

                    leakage.leakage_type,
                    leakage.amount,
                    leakage.status,
                    leakage.description,
                    leakage.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    leakage.due_date,
                    leakage.resolution_note,

                    resolver.full_name
                        AS resolved_by_name,

                    leakage.resolved_at,
                    leakage.created_at,
                    leakage.updated_at,
                    leakage.version

                FROM procurement_benefit_leakage
                    leakage

                JOIN procurement_benefit_items
                    item
                    ON item.id =
                       leakage.benefit_item_id

                JOIN app_users owner
                    ON owner.id =
                       leakage.owner_user_id

                LEFT JOIN app_users resolver
                    ON resolver.id =
                       leakage.resolved_by_user_id

                """;
    }

    private ApprovedScenarioRow mapApprovedScenario(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp approved =
                resultSet.getTimestamp(
                        "approved_at"
                );

        return new ApprovedScenarioRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "scenario_code"
                ),
                resultSet.getString(
                        "name"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getLong(
                        "selected_initiatives"
                ),
                resultSet.getBigDecimal(
                        "selected_budget"
                ),
                resultSet.getBigDecimal(
                        "target_savings"
                ),
                resultSet.getBigDecimal(
                        "average_risk"
                ),
                approved == null
                        ? null
                        : approved.toInstant()
        );
    }

    private PortfolioRow mapPortfolio(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp closed =
                resultSet.getTimestamp(
                        "closed_at"
                );

        Timestamp archived =
                resultSet.getTimestamp(
                        "archived_at"
                );

        return new PortfolioRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "portfolio_number"
                ),
                resultSet.getObject(
                        "source_scenario_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_scenario_code"
                ),
                resultSet.getString(
                        "source_scenario_name"
                ),
                resultSet.getString(
                        "currency"
                ),
                ExecutionPortfolioStatus.valueOf(
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
                resultSet.getString(
                        "authorized_by_name"
                ),
                resultSet.getTimestamp(
                        "authorized_at"
                )
                        .toInstant(),
                resultSet.getBigDecimal(
                        "baseline_selected_budget"
                ),
                resultSet.getBigDecimal(
                        "baseline_target_savings"
                ),
                resultSet.getBigDecimal(
                        "baseline_average_risk"
                ),
                resultSet.getLong(
                        "selected_initiative_count"
                ),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getBigDecimal(
                        "current_forecast_savings"
                ),
                resultSet.getBigDecimal(
                        "operational_reported_savings"
                ),
                resultSet.getBigDecimal(
                        "validated_savings"
                ),
                resultSet.getLong(
                        "active_benefit_items"
                ),
                resultSet.getLong(
                        "validation_pending_items"
                ),
                resultSet.getLong(
                        "validated_items"
                ),
                resultSet.getLong(
                        "active_assumptions"
                ),
                resultSet.getLong(
                        "invalidated_assumptions"
                ),
                resultSet.getLong(
                        "active_leakage_cases"
                ),
                resultSet.getBigDecimal(
                        "active_leakage_amount"
                ),
                resultSet.getLong(
                        "overdue_leakage_cases"
                ),
                closed == null
                        ? null
                        : closed.toInstant(),
                archived == null
                        ? null
                        : archived.toInstant(),
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

    private ItemRow mapItem(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp requestAt =
                resultSet.getTimestamp(
                        "validation_requested_at"
                );

        Timestamp validatedAt =
                resultSet.getTimestamp(
                        "validated_at"
                );

        return new ItemRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "portfolio_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "scenario_item_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "initiative_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "strategy_id",
                        UUID.class
                ),
                resultSet.getString(
                        "category_name_snapshot"
                ),
                resultSet.getString(
                        "initiative_number_snapshot"
                ),
                resultSet.getString(
                        "initiative_title_snapshot"
                ),
                resultSet.getObject(
                        "benefit_owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "benefit_owner_name"
                ),
                BenefitItemStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
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
                        "validation_requested_amount"
                ),
                resultSet.getString(
                        "validation_request_note"
                ),
                resultSet.getString(
                        "validation_requested_by_name"
                ),
                requestAt == null
                        ? null
                        : requestAt.toInstant(),
                resultSet.getBigDecimal(
                        "validated_savings"
                ),
                resultSet.getString(
                        "validated_by_name"
                ),
                resultSet.getString(
                        "validation_note"
                ),
                validatedAt == null
                        ? null
                        : validatedAt.toInstant(),
                resultSet.getObject(
                        "expected_realization_date",
                        LocalDate.class
                ),
                resultSet.getBigDecimal(
                        "active_leakage_amount"
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

    private AssumptionRow mapAssumption(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp resolved =
                resultSet.getTimestamp(
                        "resolved_at"
                );

        return new AssumptionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "portfolio_id",
                        UUID.class
                ),
                BenefitAssumptionType.valueOf(
                        resultSet.getString(
                                "assumption_type"
                        )
                ),
                resultSet.getString(
                        "description"
                ),
                resultSet.getBigDecimal(
                        "financial_impact"
                ),
                BenefitAssumptionStatus.valueOf(
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
                        "review_date",
                        LocalDate.class
                ),
                resultSet.getString(
                        "resolution_note"
                ),
                resultSet.getString(
                        "resolved_by_name"
                ),
                resolved == null
                        ? null
                        : resolved.toInstant(),
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

    private LeakageRow mapLeakage(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp resolved =
                resultSet.getTimestamp(
                        "resolved_at"
                );

        return new LeakageRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "benefit_item_id",
                        UUID.class
                ),
                resultSet.getString(
                        "initiative_number_snapshot"
                ),
                resultSet.getString(
                        "initiative_title_snapshot"
                ),
                BenefitLeakageType.valueOf(
                        resultSet.getString(
                                "leakage_type"
                        )
                ),
                resultSet.getBigDecimal(
                        "amount"
                ),
                BenefitLeakageStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
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
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                resultSet.getString(
                        "resolution_note"
                ),
                resultSet.getString(
                        "resolved_by_name"
                ),
                resolved == null
                        ? null
                        : resolved.toInstant(),
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

    public record ApprovedScenarioRow(
            UUID id,
            String scenarioCode,
            String name,
            String currency,
            String ownerName,
            long selectedInitiatives,
            BigDecimal selectedBudget,
            BigDecimal targetSavings,
            BigDecimal averageRisk,
            Instant approvedAt
    ) {
    }

    public record ScenarioSelectedItemRow(
            UUID scenarioItemId,
            UUID initiativeId,
            UUID strategyId,
            UUID initiativeOwnerUserId,
            String categoryName,
            String initiativeNumber,
            String initiativeTitle,
            BigDecimal targetSavings,
            LocalDate plannedEndDate,
            BigDecimal operationalReportedSavings
    ) {
    }

    public record PortfolioRow(
            UUID id,
            String portfolioNumber,
            UUID sourceScenarioId,
            String sourceScenarioCode,
            String sourceScenarioName,
            String currency,
            ExecutionPortfolioStatus status,
            UUID ownerUserId,
            String ownerName,
            String authorizedByName,
            Instant authorizedAt,
            BigDecimal baselineSelectedBudget,
            BigDecimal baselineTargetSavings,
            BigDecimal baselineAverageRisk,
            long selectedInitiativeCount,
            String notes,
            BigDecimal currentForecastSavings,
            BigDecimal operationalReportedSavings,
            BigDecimal validatedSavings,
            long activeBenefitItems,
            long validationPendingItems,
            long validatedItems,
            long activeAssumptions,
            long invalidatedAssumptions,
            long activeLeakageCases,
            BigDecimal activeLeakageAmount,
            long overdueLeakageCases,
            Instant closedAt,
            Instant archivedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ItemRow(
            UUID id,
            UUID portfolioId,
            UUID scenarioItemId,
            UUID initiativeId,
            UUID strategyId,
            String categoryName,
            String initiativeNumber,
            String initiativeTitle,
            UUID benefitOwnerUserId,
            String benefitOwnerName,
            BenefitItemStatus status,
            BigDecimal baselineTargetSavings,
            BigDecimal forecastSavings,
            BigDecimal operationalReportedSavings,
            BigDecimal validationRequestedAmount,
            String validationRequestNote,
            String validationRequestedByName,
            Instant validationRequestedAt,
            BigDecimal validatedSavings,
            String validatedByName,
            String validationNote,
            Instant validatedAt,
            LocalDate expectedRealizationDate,
            BigDecimal activeLeakageAmount,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record AssumptionRow(
            UUID id,
            UUID portfolioId,
            BenefitAssumptionType assumptionType,
            String description,
            BigDecimal financialImpact,
            BenefitAssumptionStatus status,
            UUID ownerUserId,
            String ownerName,
            LocalDate reviewDate,
            String resolutionNote,
            String resolvedByName,
            Instant resolvedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record LeakageRow(
            UUID id,
            UUID benefitItemId,
            String initiativeNumber,
            String initiativeTitle,
            BenefitLeakageType leakageType,
            BigDecimal amount,
            BenefitLeakageStatus status,
            String description,
            UUID ownerUserId,
            String ownerName,
            LocalDate dueDate,
            String resolutionNote,
            String resolvedByName,
            Instant resolvedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }
}
