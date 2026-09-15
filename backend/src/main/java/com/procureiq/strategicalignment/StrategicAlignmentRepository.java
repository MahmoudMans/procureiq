package com.procureiq.strategicalignment;

import com.procureiq.strategicokr.KeyResultDirection;
import com.procureiq.strategicokr.StrategicObjectiveStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Repository
public class StrategicAlignmentRepository {

    private final JdbcTemplate jdbcTemplate;

    public StrategicAlignmentRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextReviewSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_alignment_review_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<AlignmentPortfolioItem> portfolioItems(
            String currency
    ) {
        List<AlignmentPortfolioItem> items =
                new ArrayList<>();

        items.addAll(
                categoryInitiatives(
                        currency
                )
        );

        items.addAll(
                improvementInitiatives(
                        currency
                )
        );

        items.addAll(
                executionPortfolios(
                        currency
                )
        );

        items.addAll(
                riskEscalations(
                        currency
                )
        );

        return items;
    }

    private List<AlignmentPortfolioItem> categoryInitiatives(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    initiative.id,
                    initiative.initiative_number,
                    initiative.title,
                    initiative.status,
                    initiative.planned_end_date,

                    COALESCE(
                        initiative.target_savings,
                        0
                    )
                        AS strategic_value,

                    COALESCE(
                        strategy.supply_risk_score,
                        0
                    )
                        AS risk_score,

                    COALESCE(
                        initiative.target_savings,
                        0
                    )
                    *
                    LEAST(
                        GREATEST(
                            COALESCE(
                                strategy.supply_risk_score,
                                0
                            ),
                            0
                        ),
                        100
                    )
                    /
                    100
                        AS risk_exposure

                FROM procurement_category_initiatives
                    initiative

                JOIN procurement_category_strategies
                    strategy
                    ON strategy.id =
                       initiative.strategy_id

                WHERE strategy.currency = ?

                AND initiative.status IN (
                    'PLANNED',
                    'READY',
                    'IN_PROGRESS'
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new AlignmentPortfolioItem(
                                AlignmentSourceType.CATEGORY_INITIATIVE,
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "initiative_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getBigDecimal(
                                        "strategic_value"
                                ),
                                resultSet.getBigDecimal(
                                        "risk_exposure"
                                ),
                                resultSet.getBigDecimal(
                                        "risk_score"
                                ),
                                resultSet.getObject(
                                        "planned_end_date",
                                        LocalDate.class
                                )
                        ),
                currency
        );
    }

    private List<AlignmentPortfolioItem> improvementInitiatives(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    initiative.id,
                    initiative.initiative_number,
                    initiative.title,
                    initiative.status,
                    initiative.priority,
                    initiative.target_date,
                    initiative.baseline_active_exposure

                FROM procurement_improvement_initiatives
                    initiative

                WHERE initiative.currency = ?

                AND initiative.status IN (
                    'DRAFT',
                    'ACTIVE',
                    'ON_HOLD'
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new AlignmentPortfolioItem(
                                AlignmentSourceType.IMPROVEMENT_INITIATIVE,
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "initiative_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                BigDecimal.ZERO,
                                resultSet.getBigDecimal(
                                        "baseline_active_exposure"
                                ),
                                priorityScore(
                                        resultSet.getString(
                                                "priority"
                                        )
                                ),
                                resultSet.getObject(
                                        "target_date",
                                        LocalDate.class
                                )
                        ),
                currency
        );
    }

    private List<AlignmentPortfolioItem> executionPortfolios(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    portfolio.id,
                    portfolio.portfolio_number,

                    COALESCE(
                        NULLIF(
                            BTRIM(
                                portfolio.source_scenario_name
                            ),
                            ''
                        ),
                        portfolio.portfolio_number
                    )
                        AS title,

                    portfolio.status,

                    COALESCE(
                        portfolio.baseline_target_savings,
                        0
                    )
                        AS strategic_value,

                    GREATEST(
                        COALESCE(
                            portfolio.baseline_target_savings,
                            0
                        )
                        -
                        COALESCE(
                            benefit.forecast_savings,
                            0
                        ),
                        0
                    )
                    +
                    COALESCE(
                        leakage.active_leakage,
                        0
                    )
                        AS risk_exposure

                FROM procurement_execution_portfolios
                    portfolio

                LEFT JOIN LATERAL (
                    SELECT
                        SUM(
                            item.forecast_savings
                        )
                            AS forecast_savings

                    FROM procurement_benefit_items
                        item

                    WHERE
                        item.portfolio_id =
                            portfolio.id

                    AND item.status
                        <> 'CANCELLED'
                )
                    benefit
                    ON TRUE

                LEFT JOIN LATERAL (
                    SELECT
                        SUM(
                            leakage.amount
                        )
                            AS active_leakage

                    FROM procurement_benefit_leakage
                        leakage

                    JOIN procurement_benefit_items
                        item
                        ON item.id =
                           leakage.benefit_item_id

                    WHERE
                        item.portfolio_id =
                            portfolio.id

                    AND leakage.status IN (
                        'OPEN',
                        'ACCEPTED'
                    )
                )
                    leakage
                    ON TRUE

                WHERE portfolio.currency = ?

                AND portfolio.status IN (
                    'AUTHORIZED',
                    'IN_EXECUTION'
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    BigDecimal strategicValue =
                            resultSet.getBigDecimal(
                                    "strategic_value"
                            );

                    BigDecimal riskExposure =
                            resultSet.getBigDecimal(
                                    "risk_exposure"
                            );

                    BigDecimal riskScore =
                            strategicValue == null
                                    ||
                                    strategicValue.compareTo(
                                            BigDecimal.ZERO
                                    ) <= 0
                                    ? BigDecimal.ZERO
                                    : riskExposure
                                            .multiply(
                                                    new BigDecimal(
                                                            "100.00"
                                                    )
                                            )
                                            .divide(
                                                    strategicValue,
                                                    2,
                                                    java.math.RoundingMode.HALF_UP
                                            )
                                            .min(
                                                    new BigDecimal(
                                                            "100.00"
                                                    )
                                            );

                    return new AlignmentPortfolioItem(
                            AlignmentSourceType.EXECUTION_PORTFOLIO,
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "portfolio_number"
                            ),
                            resultSet.getString(
                                    "title"
                            ),
                            resultSet.getString(
                                    "status"
                            ),
                            strategicValue,
                            riskExposure,
                            riskScore,
                            null
                    );
                },
                currency
        );
    }

    private List<AlignmentPortfolioItem> riskEscalations(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    escalation.id,
                    escalation.case_number,
                    escalation.status,
                    escalation.priority,
                    escalation.due_date,

                    supplier.legal_name,

                    COALESCE(
                        latest_risk.spend_exposure,
                        0
                    )
                        AS risk_exposure,

                    COALESCE(
                        latest_risk.overall_score,
                        0
                    )
                        AS risk_score

                FROM supplier_risk_escalation_cases
                    escalation

                JOIN suppliers
                    supplier
                    ON supplier.id =
                       escalation.supplier_id

                JOIN LATERAL (
                    SELECT
                        evaluation.spend_exposure,
                        evaluation.overall_score

                    FROM supplier_risk_evaluations
                        evaluation

                    WHERE
                        evaluation.supplier_id =
                            escalation.supplier_id

                    AND evaluation.currency = ?

                    ORDER BY
                        evaluation.evaluated_at DESC

                    LIMIT 1
                )
                    latest_risk
                    ON TRUE

                WHERE escalation.status IN (
                    'OPEN',
                    'IN_PROGRESS'
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new AlignmentPortfolioItem(
                                AlignmentSourceType.RISK_ESCALATION,
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "case_number"
                                ),
                                "Supplier risk escalation — "
                                        + resultSet.getString(
                                                "legal_name"
                                        ),
                                resultSet.getString(
                                        "status"
                                ),
                                BigDecimal.ZERO,
                                resultSet.getBigDecimal(
                                        "risk_exposure"
                                ),
                                resultSet.getBigDecimal(
                                        "risk_score"
                                ),
                                resultSet.getObject(
                                        "due_date",
                                        LocalDate.class
                                )
                        ),
                currency
        );
    }

    public List<ObjectiveRow> objectives(
            String currency,
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    objective.id,
                    objective.objective_number,
                    objective.title,
                    objective.currency,
                    objective.status,
                    objective.end_date,
                    objective.owner_user_id,

                    owner.full_name
                        AS owner_name

                FROM procurement_strategic_objectives
                    objective

                JOIN app_users
                    owner
                    ON owner.id =
                       objective.owner_user_id

                WHERE objective.currency = ?
                AND objective.fiscal_year = ?
                AND objective.status
                    <> 'CANCELLED'

                ORDER BY
                    CASE objective.status
                        WHEN 'ACTIVE'
                        THEN 1
                        WHEN 'ON_HOLD'
                        THEN 2
                        WHEN 'DRAFT'
                        THEN 3
                        WHEN 'ACHIEVED'
                        THEN 4
                        ELSE 5
                    END,
                    objective.end_date,
                    objective.objective_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ObjectiveRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "objective_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                resultSet.getString(
                        "currency"
                ),
                                StrategicObjectiveStatus.valueOf(
                                        resultSet.getString(
                                                "status"
                                        )
                                ),
                                resultSet.getObject(
                                        "end_date",
                                        LocalDate.class
                                ),
                                resultSet.getObject(
                                        "owner_user_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "owner_name"
                                )
                        ),
                currency,
                fiscalYear
        );
    }

    public ObjectiveRow findObjective(
            UUID objectiveId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    objective.id,
                    objective.objective_number,
                    objective.title,
                    objective.currency,
                    objective.status,
                    objective.end_date,
                    objective.owner_user_id,

                    owner.full_name
                        AS owner_name

                FROM procurement_strategic_objectives
                    objective

                JOIN app_users
                    owner
                    ON owner.id =
                       objective.owner_user_id

                WHERE objective.id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ObjectiveRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "objective_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                resultSet.getString(
                        "currency"
                ),
                                StrategicObjectiveStatus.valueOf(
                                        resultSet.getString(
                                                "status"
                                        )
                                ),
                                resultSet.getObject(
                                        "end_date",
                                        LocalDate.class
                                ),
                                resultSet.getObject(
                                        "owner_user_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "owner_name"
                                )
                        ),
                objectiveId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<KeyResultMetricRow> objectiveKeyResults(
            UUID objectiveId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    baseline_value,
                    target_value,
                    actual_value,
                    weight_pct,
                    direction

                FROM procurement_key_results

                WHERE objective_id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new KeyResultMetricRow(
                                resultSet.getBigDecimal(
                                        "baseline_value"
                                ),
                                resultSet.getBigDecimal(
                                        "target_value"
                                ),
                                resultSet.getBigDecimal(
                                        "actual_value"
                                ),
                                resultSet.getBigDecimal(
                                        "weight_pct"
                                ),
                                KeyResultDirection.valueOf(
                                        resultSet.getString(
                                                "direction"
                                        )
                                )
                        ),
                objectiveId
        );
    }

    public List<LinkRow> linksForObjective(
            UUID objectiveId
    ) {
        return jdbcTemplate.query(
                linkSql()
                        + """
                        WHERE link.objective_id = ?

                        ORDER BY
                            link.created_at,
                            link.source_reference_snapshot
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapLink(
                                resultSet
                        ),
                objectiveId
        );
    }

    public List<LinkRow> linksForSource(
            AlignmentSourceType sourceType,
            UUID sourceEntityId
    ) {
        return jdbcTemplate.query(
                linkSql()
                        + """
                        WHERE link.source_type = ?
                        AND link.source_entity_id = ?

                        ORDER BY
                            objective.objective_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapLink(
                                resultSet
                        ),
                sourceType.name(),
                sourceEntityId
        );
    }

    public LinkRow findLink(
            UUID linkId
    ) {
        return jdbcTemplate.query(
                linkSql()
                        + """
                        WHERE link.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapLink(
                                resultSet
                        ),
                linkId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void createLink(
            UUID linkId,
            UUID objectiveId,
            StrategicAlignmentLinkInput input,
            AlignmentPortfolioItem source,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_strategic_alignment_links (
                    id,
                    objective_id,
                    source_type,
                    source_entity_id,
                    source_reference_snapshot,
                    source_title_snapshot,
                    alignment_role,
                    allocation_pct,
                    rationale,
                    created_by_user_id,
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
                linkId,
                objectiveId,
                input.sourceType()
                        .name(),
                input.sourceEntityId(),
                source.sourceReference(),
                source.sourceTitle(),
                input.alignmentRole()
                        .name(),
                input.allocationPct(),
                input.rationale()
                        .trim(),
                currentUserId
        );
    }

    public void deleteLink(
            UUID linkId
    ) {
        jdbcTemplate.update(
                """
                DELETE FROM procurement_strategic_alignment_links
                WHERE id = ?
                """,
                linkId
        );
    }

    public int okrContributionCount(
            AlignmentSourceType sourceType,
            UUID sourceEntityId
    ) {
        if (
                sourceType
                        != AlignmentSourceType.IMPROVEMENT_INITIATIVE
        ) {
            return 0;
        }

        Integer count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)

                        FROM procurement_okr_contributions
                            contribution

                        WHERE
                            contribution.improvement_initiative_id = ?
                        """,
                        Integer.class,
                        sourceEntityId
                );

        return count == null
                ? 0
                : count;
    }

    public int deadlineConflictCount(
            AlignmentSourceType sourceType,
            UUID sourceEntityId,
            LocalDate sourceDueDate
    ) {
        if (sourceDueDate == null) {
            return 0;
        }

        Integer count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)

                        FROM procurement_strategic_alignment_links
                            link

                        JOIN procurement_strategic_objectives
                            objective
                            ON objective.id =
                               link.objective_id

                        WHERE link.source_type = ?
                        AND link.source_entity_id = ?
                        AND objective.status
                            <> 'CANCELLED'
                        AND ? > objective.end_date
                        """,
                        Integer.class,
                        sourceType.name(),
                        sourceEntityId,
                        sourceDueDate
                );

        return count == null
                ? 0
                : count;
    }

    public void createReview(
            UUID reviewId,
            String reviewNumber,
            String currency,
            int fiscalYear,
            StrategicAlignmentSummaryResponse summary,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_alignment_reviews (
                    id,
                    review_number,
                    currency,
                    fiscal_year,
                    objective_count,
                    objectives_with_alignment,
                    candidate_source_count,
                    aligned_source_count,
                    unaligned_source_count,
                    fully_aligned_source_count,
                    partially_aligned_source_count,
                    split_commitment_count,
                    deadline_conflict_count,
                    strategic_value_total,
                    strategic_value_aligned,
                    risk_exposure_total,
                    risk_exposure_aligned,
                    source_coverage_pct,
                    objective_coverage_pct,
                    value_coverage_pct,
                    risk_coverage_pct,
                    schedule_alignment_pct,
                    alignment_score,
                    alignment_health,
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
                currency,
                fiscalYear,
                summary.objectiveCount(),
                summary.objectivesWithAlignment(),
                summary.candidateSourceCount(),
                summary.alignedSourceCount(),
                summary.unalignedSourceCount(),
                summary.fullyAlignedSourceCount(),
                summary.partiallyAlignedSourceCount(),
                summary.splitCommitmentCount(),
                summary.deadlineConflictCount(),
                summary.strategicValueTotal(),
                summary.strategicValueAligned(),
                summary.riskExposureTotal(),
                summary.riskExposureAligned(),
                summary.sourceCoveragePct(),
                summary.objectiveCoveragePct(),
                summary.valueCoveragePct(),
                summary.riskCoveragePct(),
                summary.scheduleAlignmentPct(),
                summary.alignmentScore(),
                summary.alignmentHealth()
                        .name(),
                currentUserId
        );
    }

    public void createReviewItem(
            UUID reviewId,
            AlignmentSourceResponse source
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_alignment_review_items (
                    id,
                    review_id,
                    source_type,
                    source_entity_id,
                    source_reference,
                    source_title,
                    source_status,
                    strategic_value,
                    risk_exposure,
                    risk_score,
                    due_date,
                    direct_allocation_pct,
                    linked_objective_count,
                    okr_contribution_count,
                    alignment_status,
                    split_commitment,
                    deadline_conflict_count,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                reviewId,
                source.sourceType()
                        .name(),
                source.sourceEntityId(),
                source.sourceReference(),
                source.sourceTitle(),
                source.sourceStatus(),
                source.strategicValue(),
                source.riskExposure(),
                source.riskScore(),
                source.dueDate(),
                source.directAllocationPct(),
                source.linkedObjectiveCount(),
                source.okrContributionCount(),
                source.alignmentStatus()
                        .name(),
                source.splitCommitment(),
                source.deadlineConflictCount()
        );
    }

    public List<ReviewRow> reviews(
            String currency,
            int fiscalYear
    ) {
        return jdbcTemplate.query(
                reviewSql()
                        + """
                        WHERE review.currency = ?
                        AND review.fiscal_year = ?

                        ORDER BY
                            review.captured_at DESC

                        LIMIT 100
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapReview(
                                resultSet
                        ),
                currency,
                fiscalYear
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

    public List<ReviewItemRow> reviewItems(
            UUID reviewId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    source_type,
                    source_entity_id,
                    source_reference,
                    source_title,
                    source_status,
                    strategic_value,
                    risk_exposure,
                    risk_score,
                    due_date,
                    direct_allocation_pct,
                    linked_objective_count,
                    okr_contribution_count,
                    alignment_status,
                    split_commitment,
                    deadline_conflict_count

                FROM procurement_alignment_review_items

                WHERE review_id = ?

                ORDER BY
                    CASE alignment_status
                        WHEN 'CONFLICT'
                        THEN 1
                        WHEN 'UNALIGNED'
                        THEN 2
                        WHEN 'PARTIAL'
                        THEN 3
                        ELSE 4
                    END,
                    risk_exposure DESC,
                    strategic_value DESC,
                    source_reference
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ReviewItemRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                AlignmentSourceType.valueOf(
                                        resultSet.getString(
                                                "source_type"
                                        )
                                ),
                                resultSet.getObject(
                                        "source_entity_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "source_reference"
                                ),
                                resultSet.getString(
                                        "source_title"
                                ),
                                resultSet.getString(
                                        "source_status"
                                ),
                                resultSet.getBigDecimal(
                                        "strategic_value"
                                ),
                                resultSet.getBigDecimal(
                                        "risk_exposure"
                                ),
                                resultSet.getBigDecimal(
                                        "risk_score"
                                ),
                                resultSet.getObject(
                                        "due_date",
                                        LocalDate.class
                                ),
                                resultSet.getBigDecimal(
                                        "direct_allocation_pct"
                                ),
                                resultSet.getInt(
                                        "linked_objective_count"
                                ),
                                resultSet.getInt(
                                        "okr_contribution_count"
                                ),
                                AlignmentStatus.valueOf(
                                        resultSet.getString(
                                                "alignment_status"
                                        )
                                ),
                                resultSet.getBoolean(
                                        "split_commitment"
                                ),
                                resultSet.getInt(
                                        "deadline_conflict_count"
                                )
                        ),
                reviewId
        );
    }

    private String linkSql() {
        return """
                SELECT
                    link.id,
                    link.objective_id,
                    objective.objective_number,
                    objective.title
                        AS objective_title,
                    link.source_type,
                    link.source_entity_id,
                    link.source_reference_snapshot,
                    link.source_title_snapshot,
                    link.alignment_role,
                    link.allocation_pct,
                    link.rationale,

                    user_account.full_name
                        AS created_by_name,

                    link.created_at

                FROM procurement_strategic_alignment_links
                    link

                JOIN procurement_strategic_objectives
                    objective
                    ON objective.id =
                       link.objective_id

                JOIN app_users
                    user_account
                    ON user_account.id =
                       link.created_by_user_id

                """;
    }

    private String reviewSql() {
        return """
                SELECT
                    review.id,
                    review.review_number,
                    review.currency,
                    review.fiscal_year,
                    review.objective_count,
                    review.objectives_with_alignment,
                    review.candidate_source_count,
                    review.aligned_source_count,
                    review.unaligned_source_count,
                    review.fully_aligned_source_count,
                    review.partially_aligned_source_count,
                    review.split_commitment_count,
                    review.deadline_conflict_count,
                    review.strategic_value_total,
                    review.strategic_value_aligned,
                    review.risk_exposure_total,
                    review.risk_exposure_aligned,
                    review.source_coverage_pct,
                    review.objective_coverage_pct,
                    review.value_coverage_pct,
                    review.risk_coverage_pct,
                    review.schedule_alignment_pct,
                    review.alignment_score,
                    review.alignment_health,

                    user_account.full_name
                        AS captured_by_name,

                    review.captured_at

                FROM procurement_alignment_reviews
                    review

                JOIN app_users
                    user_account
                    ON user_account.id =
                       review.captured_by_user_id

                """;
    }

    private LinkRow mapLink(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new LinkRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "objective_id",
                        UUID.class
                ),
                resultSet.getString(
                        "objective_number"
                ),
                resultSet.getString(
                        "objective_title"
                ),
                AlignmentSourceType.valueOf(
                        resultSet.getString(
                                "source_type"
                        )
                ),
                resultSet.getObject(
                        "source_entity_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_reference_snapshot"
                ),
                resultSet.getString(
                        "source_title_snapshot"
                ),
                AlignmentRole.valueOf(
                        resultSet.getString(
                                "alignment_role"
                        )
                ),
                resultSet.getBigDecimal(
                        "allocation_pct"
                ),
                resultSet.getString(
                        "rationale"
                ),
                resultSet.getString(
                        "created_by_name"
                ),
                resultSet.getTimestamp(
                        "created_at"
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
                resultSet.getString(
                        "currency"
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getInt(
                        "objective_count"
                ),
                resultSet.getInt(
                        "objectives_with_alignment"
                ),
                resultSet.getInt(
                        "candidate_source_count"
                ),
                resultSet.getInt(
                        "aligned_source_count"
                ),
                resultSet.getInt(
                        "unaligned_source_count"
                ),
                resultSet.getInt(
                        "fully_aligned_source_count"
                ),
                resultSet.getInt(
                        "partially_aligned_source_count"
                ),
                resultSet.getInt(
                        "split_commitment_count"
                ),
                resultSet.getInt(
                        "deadline_conflict_count"
                ),
                resultSet.getBigDecimal(
                        "strategic_value_total"
                ),
                resultSet.getBigDecimal(
                        "strategic_value_aligned"
                ),
                resultSet.getBigDecimal(
                        "risk_exposure_total"
                ),
                resultSet.getBigDecimal(
                        "risk_exposure_aligned"
                ),
                resultSet.getBigDecimal(
                        "source_coverage_pct"
                ),
                resultSet.getBigDecimal(
                        "objective_coverage_pct"
                ),
                resultSet.getBigDecimal(
                        "value_coverage_pct"
                ),
                resultSet.getBigDecimal(
                        "risk_coverage_pct"
                ),
                resultSet.getBigDecimal(
                        "schedule_alignment_pct"
                ),
                resultSet.getBigDecimal(
                        "alignment_score"
                ),
                AlignmentHealth.valueOf(
                        resultSet.getString(
                                "alignment_health"
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

    private BigDecimal priorityScore(
            String priority
    ) {
        if (priority == null) {
            return BigDecimal.ZERO;
        }

        return switch (
                priority.toUpperCase()
        ) {
            case "CRITICAL" ->
                    new BigDecimal(
                            "100.00"
                    );

            case "HIGH" ->
                    new BigDecimal(
                            "75.00"
                    );

            case "MEDIUM" ->
                    new BigDecimal(
                            "50.00"
                    );

            case "LOW" ->
                    new BigDecimal(
                            "25.00"
                    );

            default ->
                    BigDecimal.ZERO;
        };
    }

    public record ObjectiveRow(
            UUID id,
            String objectiveNumber,
            String title,
            String currency,
            StrategicObjectiveStatus status,
            LocalDate endDate,
            UUID ownerUserId,
            String ownerName
    ) {
    }

    public record KeyResultMetricRow(
            BigDecimal baselineValue,
            BigDecimal targetValue,
            BigDecimal actualValue,
            BigDecimal weightPct,
            KeyResultDirection direction
    ) {
    }

    public record LinkRow(
            UUID id,
            UUID objectiveId,
            String objectiveNumber,
            String objectiveTitle,
            AlignmentSourceType sourceType,
            UUID sourceEntityId,
            String sourceReference,
            String sourceTitle,
            AlignmentRole alignmentRole,
            BigDecimal allocationPct,
            String rationale,
            String createdByName,
            Instant createdAt
    ) {
    }

    public record ReviewRow(
            UUID id,
            String reviewNumber,
            String currency,
            int fiscalYear,
            int objectiveCount,
            int objectivesWithAlignment,
            int candidateSourceCount,
            int alignedSourceCount,
            int unalignedSourceCount,
            int fullyAlignedSourceCount,
            int partiallyAlignedSourceCount,
            int splitCommitmentCount,
            int deadlineConflictCount,
            BigDecimal strategicValueTotal,
            BigDecimal strategicValueAligned,
            BigDecimal riskExposureTotal,
            BigDecimal riskExposureAligned,
            BigDecimal sourceCoveragePct,
            BigDecimal objectiveCoveragePct,
            BigDecimal valueCoveragePct,
            BigDecimal riskCoveragePct,
            BigDecimal scheduleAlignmentPct,
            BigDecimal alignmentScore,
            AlignmentHealth alignmentHealth,
            String capturedByName,
            Instant capturedAt
    ) {
    }

    public record ReviewItemRow(
            UUID id,
            AlignmentSourceType sourceType,
            UUID sourceEntityId,
            String sourceReference,
            String sourceTitle,
            String sourceStatus,
            BigDecimal strategicValue,
            BigDecimal riskExposure,
            BigDecimal riskScore,
            LocalDate dueDate,
            BigDecimal directAllocationPct,
            int linkedObjectiveCount,
            int okrContributionCount,
            AlignmentStatus alignmentStatus,
            boolean splitCommitment,
            int deadlineConflictCount
    ) {
    }
}
