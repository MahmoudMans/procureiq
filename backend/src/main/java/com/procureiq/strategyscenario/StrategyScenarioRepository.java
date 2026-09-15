package com.procureiq.strategyscenario;

import com.procureiq.strategycockpit.BoardDimensionKey;
import com.procureiq.strategycockpit.BoardHealth;
import com.procureiq.strategycockpit.BoardMovement;
import com.procureiq.strategycockpit.BoardScorecardSummaryResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class StrategyScenarioRepository {

    private final JdbcTemplate jdbcTemplate;

    public StrategyScenarioRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextScenarioSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategy_scenario_number_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextEvaluationSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_strategy_scenario_evaluation_number_seq'
                )
                """,
                Long.class
        );
    }

    public void createScenario(
            UUID scenarioId,
            String scenarioNumber,
            StrategyScenarioInput input,
            String normalizedCurrency,
            BoardScorecardSummaryResponse baseline,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_scenarios (
                    id,
                    scenario_number,
                    name,
                    description,
                    currency,
                    fiscal_year,
                    status,
                    baseline_objective_execution_score,
                    baseline_strategic_alignment_score,
                    baseline_capacity_score,
                    baseline_capability_score,
                    baseline_succession_score,
                    baseline_overall_score,
                    baseline_health,
                    baseline_captured_at,
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
                    'DRAFT',
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                scenarioId,
                scenarioNumber,
                input.name()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                normalizedCurrency,
                input.fiscalYear(),
                baseline.objectiveExecutionScore(),
                baseline.strategicAlignmentScore(),
                baseline.capacityScore(),
                baseline.capabilityScore(),
                baseline.successionScore(),
                baseline.overallScore(),
                baseline.overallHealth()
                        .name(),
                currentUserId
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
            String currency,
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                scenarioSql()
                        + """
                        WHERE scenario.currency = ?
                        AND scenario.fiscal_year = ?

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
                            scenario.updated_at DESC,
                            scenario.scenario_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapScenario(
                                resultSet
                        ),
                currency,
                fiscalYear
        );
    }

    public void upsertAssumption(
            UUID assumptionId,
            UUID scenarioId,
            StrategyScenarioAssumptionInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_scenario_assumptions (
                    id,
                    scenario_id,
                    dimension_key,
                    adjustment_points,
                    rationale,
                    created_by_user_id,
                    updated_by_user_id,
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
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )

                ON CONFLICT (
                    scenario_id,
                    dimension_key
                )

                DO UPDATE
                SET
                    adjustment_points =
                        EXCLUDED.adjustment_points,

                    rationale =
                        EXCLUDED.rationale,

                    updated_by_user_id =
                        EXCLUDED.updated_by_user_id,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        procurement_strategy_scenario_assumptions.version + 1
                """,
                assumptionId,
                scenarioId,
                input.dimensionKey()
                        .name(),
                input.adjustmentPoints(),
                input.rationale()
                        .trim(),
                currentUserId,
                currentUserId
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
            UUID scenarioId
    ) {
        return jdbcTemplate.query(
                assumptionSql()
                        + """
                        WHERE assumption.scenario_id = ?

                        ORDER BY
                            CASE assumption.dimension_key
                                WHEN 'OBJECTIVE_EXECUTION'
                                THEN 1
                                WHEN 'STRATEGIC_ALIGNMENT'
                                THEN 2
                                WHEN 'CAPACITY_READINESS'
                                THEN 3
                                WHEN 'CAPABILITY_READINESS'
                                THEN 4
                                WHEN 'SUCCESSION_RESILIENCE'
                                THEN 5
                                ELSE 6
                            END
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAssumption(
                                resultSet
                        ),
                scenarioId
        );
    }

    public void deleteAssumption(
            UUID assumptionId
    ) {
        jdbcTemplate.update(
                """
                DELETE FROM procurement_strategy_scenario_assumptions
                WHERE id = ?
                """,
                assumptionId
        );
    }

    public void markScenarioDraft(
            UUID scenarioId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_scenarios

                SET
                    status =
                        'DRAFT',

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status IN (
                    'DRAFT',
                    'EVALUATED'
                )
                """,
                scenarioId
        );
    }

    public void createEvaluation(
            UUID evaluationId,
            String evaluationNumber,
            UUID scenarioId,
            BigDecimal baselineOverallScore,
            BigDecimal simulatedOverallScore,
            BoardHealth simulatedHealth,
            BigDecimal scoreDelta,
            BoardMovement movement,
            int assumptionCount,
            int improvedDimensionCount,
            int deterioratedDimensionCount,
            String generatedSummary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_scenario_evaluations (
                    id,
                    evaluation_number,
                    scenario_id,
                    baseline_overall_score,
                    simulated_overall_score,
                    simulated_health,
                    score_delta,
                    movement,
                    assumption_count,
                    improved_dimension_count,
                    deteriorated_dimension_count,
                    generated_summary,
                    evaluated_by_user_id,
                    evaluated_at
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
                evaluationId,
                evaluationNumber,
                scenarioId,
                baselineOverallScore,
                simulatedOverallScore,
                simulatedHealth.name(),
                scoreDelta,
                movement.name(),
                assumptionCount,
                improvedDimensionCount,
                deterioratedDimensionCount,
                generatedSummary,
                currentUserId
        );
    }

    public void createEvaluationDimension(
            UUID evaluationId,
            StrategyScenarioEvaluationDimensionResponse dimension
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategy_scenario_evaluation_dimensions (
                    id,
                    evaluation_id,
                    dimension_key,
                    dimension_label,
                    weight_pct,
                    baseline_score,
                    adjustment_points,
                    simulated_score,
                    weighted_contribution,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                evaluationId,
                dimension.dimensionKey()
                        .name(),
                dimension.dimensionLabel(),
                dimension.weightPct(),
                dimension.baselineScore(),
                dimension.adjustmentPoints(),
                dimension.simulatedScore(),
                dimension.weightedContribution(),
                dimension.health()
                        .name()
        );
    }

    public void markScenarioEvaluated(
            UUID scenarioId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_scenarios

                SET
                    status =
                        'EVALUATED',

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status IN (
                    'DRAFT',
                    'EVALUATED'
                )
                """,
                scenarioId
        );
    }

    public EvaluationRow latestEvaluation(
            UUID scenarioId
    ) {
        return jdbcTemplate.query(
                evaluationSql()
                        + """
                        WHERE evaluation.scenario_id = ?

                        ORDER BY
                            evaluation.evaluated_at DESC

                        LIMIT 1
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEvaluation(
                                resultSet
                        ),
                scenarioId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public EvaluationRow findEvaluation(
            UUID evaluationId
    ) {
        return jdbcTemplate.query(
                evaluationSql()
                        + """
                        WHERE evaluation.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEvaluation(
                                resultSet
                        ),
                evaluationId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<EvaluationDimensionRow> evaluationDimensions(
            UUID evaluationId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    dimension_key,
                    dimension_label,
                    weight_pct,
                    baseline_score,
                    adjustment_points,
                    simulated_score,
                    weighted_contribution,
                    health

                FROM procurement_strategy_scenario_evaluation_dimensions

                WHERE evaluation_id = ?

                ORDER BY
                    CASE dimension_key
                        WHEN 'OBJECTIVE_EXECUTION'
                        THEN 1
                        WHEN 'STRATEGIC_ALIGNMENT'
                        THEN 2
                        WHEN 'CAPACITY_READINESS'
                        THEN 3
                        WHEN 'CAPABILITY_READINESS'
                        THEN 4
                        WHEN 'SUCCESSION_RESILIENCE'
                        THEN 5
                        ELSE 6
                    END
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new EvaluationDimensionRow(
                                BoardDimensionKey.valueOf(
                                        resultSet.getString(
                                                "dimension_key"
                                        )
                                ),
                                resultSet.getString(
                                        "dimension_label"
                                ),
                                resultSet.getBigDecimal(
                                        "weight_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_score"
                                ),
                                resultSet.getBigDecimal(
                                        "adjustment_points"
                                ),
                                resultSet.getBigDecimal(
                                        "simulated_score"
                                ),
                                resultSet.getBigDecimal(
                                        "weighted_contribution"
                                ),
                                BoardHealth.valueOf(
                                        resultSet.getString(
                                                "health"
                                        )
                                )
                        ),
                evaluationId
        );
    }

    public void approveScenario(
            UUID scenarioId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_scenarios

                SET
                    status =
                        'APPROVED',

                    approval_note = ?,

                    approved_by_user_id = ?,

                    approved_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status =
                    'EVALUATED'
                """,
                note.trim(),
                currentUserId,
                scenarioId
        );
    }

    public void archiveScenario(
            UUID scenarioId,
            String note,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_strategy_scenarios

                SET
                    status =
                        'ARCHIVED',

                    archive_note = ?,

                    archived_by_user_id = ?,

                    archived_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE id = ?
                AND status
                    <> 'ARCHIVED'
                """,
                note.trim(),
                currentUserId,
                scenarioId
        );
    }

    private String scenarioSql() {
        return """
                SELECT
                    scenario.id,
                    scenario.scenario_number,
                    scenario.name,
                    scenario.description,
                    scenario.currency,
                    scenario.fiscal_year,
                    scenario.status,
                    scenario.baseline_objective_execution_score,
                    scenario.baseline_strategic_alignment_score,
                    scenario.baseline_capacity_score,
                    scenario.baseline_capability_score,
                    scenario.baseline_succession_score,
                    scenario.baseline_overall_score,
                    scenario.baseline_health,
                    scenario.baseline_captured_at,
                    scenario.approval_note,

                    approver.full_name
                        AS approved_by_name,

                    scenario.approved_at,
                    scenario.archive_note,

                    creator.full_name
                        AS created_by_name,

                    scenario.created_at,
                    scenario.updated_at,
                    scenario.version

                FROM procurement_strategy_scenarios
                    scenario

                JOIN app_users
                    creator
                    ON creator.id =
                       scenario.created_by_user_id

                LEFT JOIN app_users
                    approver
                    ON approver.id =
                       scenario.approved_by_user_id

                """;
    }

    private String assumptionSql() {
        return """
                SELECT
                    assumption.id,
                    assumption.scenario_id,
                    assumption.dimension_key,
                    assumption.adjustment_points,
                    assumption.rationale,

                    creator.full_name
                        AS created_by_name,

                    updater.full_name
                        AS updated_by_name,

                    assumption.created_at,
                    assumption.updated_at,
                    assumption.version

                FROM procurement_strategy_scenario_assumptions
                    assumption

                JOIN app_users
                    creator
                    ON creator.id =
                       assumption.created_by_user_id

                JOIN app_users
                    updater
                    ON updater.id =
                       assumption.updated_by_user_id

                """;
    }

    private String evaluationSql() {
        return """
                SELECT
                    evaluation.id,
                    evaluation.evaluation_number,
                    evaluation.scenario_id,
                    evaluation.baseline_overall_score,
                    evaluation.simulated_overall_score,
                    evaluation.simulated_health,
                    evaluation.score_delta,
                    evaluation.movement,
                    evaluation.assumption_count,
                    evaluation.improved_dimension_count,
                    evaluation.deteriorated_dimension_count,
                    evaluation.generated_summary,

                    evaluator.full_name
                        AS evaluated_by_name,

                    evaluation.evaluated_at

                FROM procurement_strategy_scenario_evaluations
                    evaluation

                JOIN app_users
                    evaluator
                    ON evaluator.id =
                       evaluation.evaluated_by_user_id

                """;
    }

    private ScenarioRow mapScenario(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ScenarioRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "scenario_number"
                ),
                resultSet.getString(
                        "name"
                ),
                resultSet.getString(
                        "description"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                StrategyScenarioStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getBigDecimal(
                        "baseline_objective_execution_score"
                ),
                resultSet.getBigDecimal(
                        "baseline_strategic_alignment_score"
                ),
                resultSet.getBigDecimal(
                        "baseline_capacity_score"
                ),
                resultSet.getBigDecimal(
                        "baseline_capability_score"
                ),
                resultSet.getBigDecimal(
                        "baseline_succession_score"
                ),
                resultSet.getBigDecimal(
                        "baseline_overall_score"
                ),
                BoardHealth.valueOf(
                        resultSet.getString(
                                "baseline_health"
                        )
                ),
                resultSet.getTimestamp(
                        "baseline_captured_at"
                )
                        .toInstant(),
                resultSet.getString(
                        "approval_note"
                ),
                resultSet.getString(
                        "approved_by_name"
                ),
                instant(
                        resultSet,
                        "approved_at"
                ),
                resultSet.getString(
                        "archive_note"
                ),
                resultSet.getString(
                        "created_by_name"
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
        return new AssumptionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "scenario_id",
                        UUID.class
                ),
                BoardDimensionKey.valueOf(
                        resultSet.getString(
                                "dimension_key"
                        )
                ),
                resultSet.getBigDecimal(
                        "adjustment_points"
                ),
                resultSet.getString(
                        "rationale"
                ),
                resultSet.getString(
                        "created_by_name"
                ),
                resultSet.getString(
                        "updated_by_name"
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

    private EvaluationRow mapEvaluation(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new EvaluationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "evaluation_number"
                ),
                resultSet.getObject(
                        "scenario_id",
                        UUID.class
                ),
                resultSet.getBigDecimal(
                        "baseline_overall_score"
                ),
                resultSet.getBigDecimal(
                        "simulated_overall_score"
                ),
                BoardHealth.valueOf(
                        resultSet.getString(
                                "simulated_health"
                        )
                ),
                resultSet.getBigDecimal(
                        "score_delta"
                ),
                BoardMovement.valueOf(
                        resultSet.getString(
                                "movement"
                        )
                ),
                resultSet.getInt(
                        "assumption_count"
                ),
                resultSet.getInt(
                        "improved_dimension_count"
                ),
                resultSet.getInt(
                        "deteriorated_dimension_count"
                ),
                resultSet.getString(
                        "generated_summary"
                ),
                resultSet.getString(
                        "evaluated_by_name"
                ),
                resultSet.getTimestamp(
                        "evaluated_at"
                )
                        .toInstant()
        );
    }

    private Instant instant(
            java.sql.ResultSet resultSet,
            String column
    ) throws java.sql.SQLException {
        Timestamp timestamp =
                resultSet.getTimestamp(
                        column
                );

        return timestamp == null
                ? null
                : timestamp.toInstant();
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
            String scenarioNumber,
            String name,
            String description,
            String currency,
            int fiscalYear,
            StrategyScenarioStatus status,
            BigDecimal baselineObjectiveExecutionScore,
            BigDecimal baselineStrategicAlignmentScore,
            BigDecimal baselineCapacityScore,
            BigDecimal baselineCapabilityScore,
            BigDecimal baselineSuccessionScore,
            BigDecimal baselineOverallScore,
            BoardHealth baselineHealth,
            Instant baselineCapturedAt,
            String approvalNote,
            String approvedByName,
            Instant approvedAt,
            String archiveNote,
            String createdByName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record AssumptionRow(
            UUID id,
            UUID scenarioId,
            BoardDimensionKey dimensionKey,
            BigDecimal adjustmentPoints,
            String rationale,
            String createdByName,
            String updatedByName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record EvaluationRow(
            UUID id,
            String evaluationNumber,
            UUID scenarioId,
            BigDecimal baselineOverallScore,
            BigDecimal simulatedOverallScore,
            BoardHealth simulatedHealth,
            BigDecimal scoreDelta,
            BoardMovement movement,
            int assumptionCount,
            int improvedDimensionCount,
            int deterioratedDimensionCount,
            String generatedSummary,
            String evaluatedByName,
            Instant evaluatedAt
    ) {
    }

    public record EvaluationDimensionRow(
            BoardDimensionKey dimensionKey,
            String dimensionLabel,
            BigDecimal weightPct,
            BigDecimal baselineScore,
            BigDecimal adjustmentPoints,
            BigDecimal simulatedScore,
            BigDecimal weightedContribution,
            BoardHealth health
    ) {
    }
}
