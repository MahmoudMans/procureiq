package com.procureiq.portfoliooptimization;

import com.procureiq.categorymanagement.CategoryInitiativePriority;
import com.procureiq.categorymanagement.CategoryInitiativeType;
import com.procureiq.categorymanagement.CategoryMatrixPosition;
import com.procureiq.user.ProcurementRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class PortfolioOptimizationRepository {

    private final JdbcTemplate jdbcTemplate;

    public PortfolioOptimizationRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextScenarioSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_portfolio_scenario_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<PortfolioOptimizationCandidate> candidates(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    initiative.id,
                    initiative.initiative_number,
                    strategy.category_name,
                    initiative.title,
                    initiative.initiative_type,
                    initiative.priority,
                    strategy.matrix_position,
                    initiative.estimated_value,
                    initiative.target_savings,
                    strategy.strategic_value_score,
                    strategy.supply_risk_score

                FROM procurement_category_initiatives
                    initiative

                JOIN procurement_category_strategies
                    strategy
                    ON strategy.id =
                       initiative.strategy_id

                WHERE strategy.currency = ?

                AND strategy.status IN (
                    'DRAFT',
                    'ACTIVE',
                    'ON_HOLD'
                )

                AND initiative.status IN (
                    'PLANNED',
                    'READY'
                )

                ORDER BY
                    strategy.category_name,
                    initiative.initiative_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new PortfolioOptimizationCandidate(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "initiative_number"
                                ),
                                resultSet.getString(
                                        "category_name"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                CategoryInitiativeType.valueOf(
                                        resultSet.getString(
                                                "initiative_type"
                                        )
                                ),
                                CategoryInitiativePriority.valueOf(
                                        resultSet.getString(
                                                "priority"
                                        )
                                ),
                                CategoryMatrixPosition.valueOf(
                                        resultSet.getString(
                                                "matrix_position"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "estimated_value"
                                ),
                                resultSet.getBigDecimal(
                                        "target_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "strategic_value_score"
                                ),
                                resultSet.getBigDecimal(
                                        "supply_risk_score"
                                )
                        ),
                currency
        );
    }

    public void createScenario(
            UUID scenarioId,
            String scenarioCode,
            PortfolioScenarioInput input,
            String currency,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_portfolio_scenarios (
                    id,
                    scenario_code,
                    name,
                    currency,
                    status,
                    owner_user_id,
                    budget_limit,
                    max_initiatives,
                    max_average_risk_score,
                    min_total_target_savings,
                    allow_critical_priority,
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
                    'DRAFT',
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
                scenarioId,
                scenarioCode,
                input.name()
                        .trim(),
                currency,
                ownerUserId,
                input.budgetLimit(),
                input.maxInitiatives(),
                input.maxAverageRiskScore(),
                input.minTotalTargetSavings(),
                input.allowCriticalPriority(),
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public ScenarioRow findScenario(
            UUID scenarioId
    ) {
        return jdbcTemplate.query(
                scenarioSql()
                        + """
                        WHERE scenario.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapScenario(
                                resultSet
                        ),
                scenarioId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ScenarioRow> scenarios(
            String currency
    ) {
        return jdbcTemplate.query(
                scenarioSql()
                        + """
                        WHERE scenario.currency = ?

                        ORDER BY
                            CASE scenario.status
                                WHEN 'APPROVED'
                                THEN 1
                                WHEN 'EVALUATED'
                                THEN 2
                                WHEN 'DRAFT'
                                THEN 3
                                ELSE 4
                            END,
                            scenario.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapScenario(
                                resultSet
                        ),
                currency
        );
    }

    public void clearScenarioItems(
            UUID scenarioId
    ) {
        jdbcTemplate.update(
                """
                DELETE FROM procurement_portfolio_scenario_items
                WHERE scenario_id = ?
                """,
                scenarioId
        );
    }

    public void insertScenarioItem(
            UUID scenarioId,
            PortfolioOptimizationCandidate candidate,
            PortfolioOptimizationSelection selection
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_portfolio_scenario_items (
                    id,
                    scenario_id,
                    initiative_id,
                    initiative_number,
                    category_name,
                    initiative_title,
                    initiative_type,
                    priority,
                    matrix_position,
                    decision,
                    rank_position,
                    estimated_value,
                    target_savings,
                    savings_efficiency_pct,
                    strategic_value_score,
                    supply_risk_score,
                    priority_score,
                    matrix_urgency_score,
                    utility_score,
                    exclusion_reason,
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
                scenarioId,
                candidate.initiativeId(),
                candidate.initiativeNumber(),
                candidate.categoryName(),
                candidate.title(),
                candidate.initiativeType()
                        .name(),
                candidate.priority()
                        .name(),
                candidate.matrixPosition()
                        .name(),
                selection.decision()
                        .name(),
                selection.rankPosition(),
                candidate.estimatedValue(),
                candidate.targetSavings(),
                selection.savingsEfficiencyPct(),
                candidate.strategicValueScore(),
                candidate.supplyRiskScore(),
                selection.priorityScore(),
                selection.matrixUrgencyScore(),
                selection.utilityScore(),
                selection.exclusionReason()
        );
    }

    public void markEvaluated(
            UUID scenarioId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_portfolio_scenarios
                SET
                    status =
                        'EVALUATED',
                    evaluated_at =
                        CURRENT_TIMESTAMP,
                    approved_at =
                        NULL,
                    approved_by_user_id =
                        NULL,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                scenarioId
        );
    }

    public void approveScenario(
            UUID scenarioId,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_portfolio_scenarios
                SET
                    status =
                        'APPROVED',
                    approved_at =
                        CURRENT_TIMESTAMP,
                    approved_by_user_id = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'EVALUATED'
                """,
                currentUserId,
                scenarioId
        );
    }

    public void archiveScenario(
            UUID scenarioId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_portfolio_scenarios
                SET
                    status =
                        'ARCHIVED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status
                    <> 'ARCHIVED'
                """,
                scenarioId
        );
    }

    public List<ItemRow> items(
            UUID scenarioId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    scenario_id,
                    initiative_id,
                    initiative_number,
                    category_name,
                    initiative_title,
                    initiative_type,
                    priority,
                    matrix_position,
                    decision,
                    rank_position,
                    estimated_value,
                    target_savings,
                    savings_efficiency_pct,
                    strategic_value_score,
                    supply_risk_score,
                    priority_score,
                    matrix_urgency_score,
                    utility_score,
                    exclusion_reason

                FROM procurement_portfolio_scenario_items

                WHERE scenario_id = ?

                ORDER BY
                    CASE decision
                        WHEN 'SELECTED'
                        THEN 1
                        ELSE 2
                    END,
                    rank_position NULLS LAST,
                    utility_score DESC,
                    initiative_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ItemRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "scenario_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "initiative_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "initiative_number"
                                ),
                                resultSet.getString(
                                        "category_name"
                                ),
                                resultSet.getString(
                                        "initiative_title"
                                ),
                                CategoryInitiativeType.valueOf(
                                        resultSet.getString(
                                                "initiative_type"
                                        )
                                ),
                                CategoryInitiativePriority.valueOf(
                                        resultSet.getString(
                                                "priority"
                                        )
                                ),
                                CategoryMatrixPosition.valueOf(
                                        resultSet.getString(
                                                "matrix_position"
                                        )
                                ),
                                PortfolioScenarioDecision.valueOf(
                                        resultSet.getString(
                                                "decision"
                                        )
                                ),
                                (
                                        Integer
                                )
                                resultSet.getObject(
                                        "rank_position"
                                ),
                                resultSet.getBigDecimal(
                                        "estimated_value"
                                ),
                                resultSet.getBigDecimal(
                                        "target_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "savings_efficiency_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "strategic_value_score"
                                ),
                                resultSet.getBigDecimal(
                                        "supply_risk_score"
                                ),
                                resultSet.getBigDecimal(
                                        "priority_score"
                                ),
                                resultSet.getBigDecimal(
                                        "matrix_urgency_score"
                                ),
                                resultSet.getBigDecimal(
                                        "utility_score"
                                ),
                                resultSet.getString(
                                        "exclusion_reason"
                                )
                        ),
                scenarioId
        );
    }

    public List<PortfolioUserOptionResponse> users() {
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
                        new PortfolioUserOptionResponse(
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

    private String scenarioSql() {
        return """
                SELECT
                    scenario.id,
                    scenario.scenario_code,
                    scenario.name,
                    scenario.currency,
                    scenario.status,
                    scenario.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    scenario.budget_limit,
                    scenario.max_initiatives,
                    scenario.max_average_risk_score,
                    scenario.min_total_target_savings,
                    scenario.allow_critical_priority,
                    scenario.notes,

                    COUNT(
                        item.id
                    )
                        AS candidate_count,

                    COUNT(
                        item.id
                    )
                    FILTER (
                        WHERE
                            item.decision =
                                'SELECTED'
                    )
                        AS selected_count,

                    COUNT(
                        item.id
                    )
                    FILTER (
                        WHERE
                            item.decision =
                                'EXCLUDED'
                    )
                        AS excluded_count,

                    COALESCE(
                        SUM(
                            item.estimated_value
                        )
                        FILTER (
                            WHERE
                                item.decision =
                                    'SELECTED'
                        ),
                        0
                    )
                        AS selected_budget,

                    COALESCE(
                        SUM(
                            item.target_savings
                        )
                        FILTER (
                            WHERE
                                item.decision =
                                    'SELECTED'
                        ),
                        0
                    )
                        AS selected_target_savings,

                    COALESCE(
                        AVG(
                            item.supply_risk_score
                        )
                        FILTER (
                            WHERE
                                item.decision =
                                    'SELECTED'
                        ),
                        0
                    )
                        AS average_selected_risk,

                    scenario.evaluated_at,
                    scenario.approved_at,

                    approver.full_name
                        AS approved_by_name,

                    scenario.created_at,
                    scenario.updated_at,
                    scenario.version

                FROM procurement_portfolio_scenarios
                    scenario

                JOIN app_users owner
                    ON owner.id =
                       scenario.owner_user_id

                LEFT JOIN app_users approver
                    ON approver.id =
                       scenario.approved_by_user_id

                LEFT JOIN procurement_portfolio_scenario_items
                    item
                    ON item.scenario_id =
                       scenario.id

                GROUP BY
                    scenario.id,
                    owner.full_name,
                    approver.full_name

                """;
    }

    private ScenarioRow mapScenario(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp evaluated =
                resultSet.getTimestamp(
                        "evaluated_at"
                );

        Timestamp approved =
                resultSet.getTimestamp(
                        "approved_at"
                );

        return new ScenarioRow(
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
                PortfolioScenarioStatus.valueOf(
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
                        "budget_limit"
                ),
                resultSet.getInt(
                        "max_initiatives"
                ),
                resultSet.getBigDecimal(
                        "max_average_risk_score"
                ),
                resultSet.getBigDecimal(
                        "min_total_target_savings"
                ),
                resultSet.getBoolean(
                        "allow_critical_priority"
                ),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getLong(
                        "candidate_count"
                ),
                resultSet.getLong(
                        "selected_count"
                ),
                resultSet.getLong(
                        "excluded_count"
                ),
                resultSet.getBigDecimal(
                        "selected_budget"
                ),
                resultSet.getBigDecimal(
                        "selected_target_savings"
                ),
                resultSet.getBigDecimal(
                        "average_selected_risk"
                ),
                evaluated == null
                        ? null
                        : evaluated.toInstant(),
                approved == null
                        ? null
                        : approved.toInstant(),
                resultSet.getString(
                        "approved_by_name"
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

    public record ScenarioRow(
            UUID id,
            String scenarioCode,
            String name,
            String currency,
            PortfolioScenarioStatus status,
            UUID ownerUserId,
            String ownerName,
            BigDecimal budgetLimit,
            int maxInitiatives,
            BigDecimal maxAverageRiskScore,
            BigDecimal minTotalTargetSavings,
            boolean allowCriticalPriority,
            String notes,
            long candidateCount,
            long selectedCount,
            long excludedCount,
            BigDecimal selectedBudget,
            BigDecimal selectedTargetSavings,
            BigDecimal averageSelectedRisk,
            Instant evaluatedAt,
            Instant approvedAt,
            String approvedByName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ItemRow(
            UUID id,
            UUID scenarioId,
            UUID initiativeId,
            String initiativeNumber,
            String categoryName,
            String initiativeTitle,
            CategoryInitiativeType initiativeType,
            CategoryInitiativePriority priority,
            CategoryMatrixPosition matrixPosition,
            PortfolioScenarioDecision decision,
            Integer rankPosition,
            BigDecimal estimatedValue,
            BigDecimal targetSavings,
            BigDecimal savingsEfficiencyPct,
            BigDecimal strategicValueScore,
            BigDecimal supplyRiskScore,
            BigDecimal priorityScore,
            BigDecimal matrixUrgencyScore,
            BigDecimal utilityScore,
            String exclusionReason
    ) {
    }
}
