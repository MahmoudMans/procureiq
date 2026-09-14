package com.procureiq.suppliermonitoring;

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
public class SupplierRiskMonitoringRepository {

    private final JdbcTemplate jdbcTemplate;

    public SupplierRiskMonitoringRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextEscalationSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'supplier_risk_escalation_case_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<SupplierBaselineRow> suppliersWithSpend(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                WITH supplier_spend AS (
                    SELECT
                        supplier_id,

                        SUM(
                            total_amount
                        )
                            AS supplier_spend

                    FROM purchase_orders

                    WHERE currency = ?

                    AND status
                        <> 'CANCELLED'

                    GROUP BY
                        supplier_id
                ),

                category_spend AS (
                    SELECT
                        COALESCE(
                            NULLIF(
                                BTRIM(
                                    supplier.category
                                ),
                                ''
                            ),
                            'Uncategorized'
                        )
                            AS category,

                        SUM(
                            COALESCE(
                                supplier_spend.supplier_spend,
                                0
                            )
                        )
                            AS category_total

                    FROM suppliers supplier

                    LEFT JOIN supplier_spend
                        ON supplier_spend.supplier_id =
                           supplier.id

                    WHERE supplier.status =
                        'ACTIVE'

                    GROUP BY
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

                SELECT
                    supplier.id,
                    supplier.supplier_code,
                    supplier.legal_name,
                    supplier.category,
                    supplier.country,

                    COALESCE(
                        supplier_spend.supplier_spend,
                        0
                    )
                        AS supplier_spend,

                    COALESCE(
                        category_spend.category_total,
                        0
                    )
                        AS category_total,

                    CASE
                        WHEN COALESCE(
                            category_spend.category_total,
                            0
                        ) = 0
                        THEN 0

                        ELSE ROUND(
                            (
                                COALESCE(
                                    supplier_spend.supplier_spend,
                                    0
                                )
                                /
                                category_spend.category_total
                                *
                                100
                            )::NUMERIC,
                            2
                        )
                    END
                        AS category_share

                FROM suppliers supplier

                LEFT JOIN supplier_spend
                    ON supplier_spend.supplier_id =
                       supplier.id

                LEFT JOIN category_spend
                    ON category_spend.category =
                       COALESCE(
                           NULLIF(
                               BTRIM(
                                   supplier.category
                               ),
                               ''
                           ),
                           'Uncategorized'
                       )

                WHERE supplier.status =
                    'ACTIVE'

                ORDER BY
                    supplier.legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SupplierBaselineRow(
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
                                        "supplier_spend"
                                ),
                                resultSet.getBigDecimal(
                                        "category_share"
                                )
                        ),
                currency
        );
    }

    public OnboardingSignalRow onboardingSignal(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    status,
                    activation_clearance,
                    requalification_due_date

                FROM supplier_onboarding_cases

                WHERE supplier_id = ?

                ORDER BY
                    created_at DESC

                LIMIT 1
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new OnboardingSignalRow(
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getBoolean(
                                        "activation_clearance"
                                ),
                                resultSet.getObject(
                                        "requalification_due_date",
                                        LocalDate.class
                                )
                        ),
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public DocumentSignalRow documentSignal(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                WITH applicable AS (
                    SELECT
                        requirement.id

                    FROM supplier_document_requirements
                        requirement

                    JOIN suppliers supplier
                        ON supplier.id = ?

                    WHERE requirement.active =
                        TRUE

                    AND requirement.mandatory =
                        TRUE

                    AND (
                        requirement.category_scope
                            IS NULL
                        OR LOWER(
                            BTRIM(
                                requirement.category_scope
                            )
                        )
                        =
                        LOWER(
                            BTRIM(
                                supplier.category
                            )
                        )
                    )
                )

                SELECT
                    COUNT(*)
                        AS mandatory_documents,

                    COUNT(*)
                    FILTER (
                        WHERE
                            latest.status =
                                'VALID'
                        AND (
                            latest.expiry_date
                                IS NULL
                            OR latest.expiry_date
                                >= CURRENT_DATE
                        )
                    )
                        AS current_documents,

                    COUNT(*)
                    FILTER (
                        WHERE
                            latest.status =
                                'SUBMITTED'
                    )
                        AS submitted_documents,

                    COUNT(*)
                    FILTER (
                        WHERE
                            latest.status =
                                'VALID'
                        AND latest.expiry_date
                            < CURRENT_DATE
                    )
                        AS expired_documents,

                    COUNT(*)
                    FILTER (
                        WHERE
                            latest.status =
                                'REJECTED'
                    )
                        AS rejected_documents

                FROM applicable

                LEFT JOIN supplier_compliance_documents
                    document
                    ON document.supplier_id = ?
                    AND document.requirement_id =
                        applicable.id

                LEFT JOIN LATERAL (
                    SELECT
                        version.status,
                        version.expiry_date

                    FROM supplier_compliance_document_versions
                        version

                    WHERE
                        version.document_id =
                            document.id

                    ORDER BY
                        version.version_number DESC

                    LIMIT 1
                )
                    latest
                    ON TRUE
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new DocumentSignalRow(
                                resultSet.getInt(
                                        "mandatory_documents"
                                ),
                                resultSet.getInt(
                                        "current_documents"
                                ),
                                resultSet.getInt(
                                        "submitted_documents"
                                ),
                                resultSet.getInt(
                                        "expired_documents"
                                ),
                                resultSet.getInt(
                                        "rejected_documents"
                                )
                        ),
                supplierId,
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(
                        new DocumentSignalRow(
                                0,
                                0,
                                0,
                                0,
                                0
                        )
                );
    }

    public EsgSignalRow esgSignal(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    status,
                    rating,
                    next_review_date

                FROM supplier_sustainability_assessments

                WHERE supplier_id = ?

                ORDER BY
                    created_at DESC

                LIMIT 1
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new EsgSignalRow(
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getString(
                                        "rating"
                                ),
                                resultSet.getObject(
                                        "next_review_date",
                                        LocalDate.class
                                )
                        ),
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public AnomalySignalRow anomalySignal(
            UUID supplierId,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    COUNT(*)
                    FILTER (
                        WHERE
                            finding.status IN (
                                'OPEN',
                                'UNDER_INVESTIGATION'
                            )
                    )
                        AS active_findings,

                    COUNT(*)
                    FILTER (
                        WHERE
                            finding.status IN (
                                'OPEN',
                                'UNDER_INVESTIGATION'
                            )
                        AND rule.default_severity =
                            'CRITICAL'
                    )
                        AS critical_findings,

                    COALESCE(
                        MAX(
                            finding.anomaly_score
                        )
                        FILTER (
                            WHERE
                                finding.status IN (
                                    'OPEN',
                                    'UNDER_INVESTIGATION'
                                )
                        ),
                        0
                    )
                        AS max_anomaly_score

                FROM procurement_anomaly_findings
                    finding

                JOIN procurement_anomaly_rules rule
                    ON rule.id =
                       finding.rule_id

                WHERE (
                    finding.entity_id = ?
                    OR finding.related_entity_id = ?
                )

                AND (
                    finding.currency = ?
                    OR finding.currency
                        IS NULL
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new AnomalySignalRow(
                                resultSet.getLong(
                                        "active_findings"
                                ),
                                resultSet.getLong(
                                        "critical_findings"
                                ),
                                resultSet.getBigDecimal(
                                        "max_anomaly_score"
                                )
                        ),
                supplierId,
                supplierId,
                currency
        )
                .stream()
                .findFirst()
                .orElse(
                        new AnomalySignalRow(
                                0,
                                0,
                                BigDecimal.ZERO
                        )
                );
    }

    public CollaborationSignalRow collaborationSignal(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    (
                        SELECT COUNT(*)

                        FROM supplier_collaboration_workspaces
                            workspace

                        WHERE
                            workspace.supplier_id = ?

                        AND workspace.status =
                            'WAITING_SUPPLIER'
                    )
                        AS waiting_supplier,

                    (
                        SELECT COUNT(*)

                        FROM supplier_collaboration_workspaces
                            workspace

                        WHERE
                            workspace.supplier_id = ?

                        AND workspace.status =
                            'WAITING_SUPPLIER'

                        AND workspace.response_due_at
                            IS NOT NULL

                        AND workspace.response_due_at
                            < CURRENT_TIMESTAMP
                    )
                        AS sla_breaches,

                    (
                        SELECT COUNT(*)

                        FROM supplier_collaboration_actions
                            action

                        JOIN supplier_collaboration_workspaces
                            workspace
                            ON workspace.id =
                               action.workspace_id

                        WHERE
                            workspace.supplier_id = ?

                        AND action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )

                        AND action.due_at
                            < CURRENT_TIMESTAMP
                    )
                        AS overdue_actions
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CollaborationSignalRow(
                                resultSet.getLong(
                                        "waiting_supplier"
                                ),
                                resultSet.getLong(
                                        "sla_breaches"
                                ),
                                resultSet.getLong(
                                        "overdue_actions"
                                )
                        ),
                supplierId,
                supplierId,
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(
                        new CollaborationSignalRow(
                                0,
                                0,
                                0
                        )
                );
    }

    public CommercialSignalRow commercialSignal(
            UUID supplierId,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    COUNT(*)
                        AS open_findings,

                    COALESCE(
                        SUM(
                            leakage_amount
                        ),
                        0
                    )
                        AS exposure

                FROM commercial_leakage_findings

                WHERE supplier_id = ?

                AND currency = ?

                AND status =
                    'OPEN'
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CommercialSignalRow(
                                resultSet.getLong(
                                        "open_findings"
                                ),
                                resultSet.getBigDecimal(
                                        "exposure"
                                )
                        ),
                supplierId,
                currency
        )
                .stream()
                .findFirst()
                .orElse(
                        new CommercialSignalRow(
                                0,
                                BigDecimal.ZERO
                        )
                );
    }

    public EvaluationRow latestEvaluation(
            UUID supplierId,
            String currency
    ) {
        return jdbcTemplate.query(
                evaluationSql()
                        + """
                        WHERE evaluation.supplier_id = ?
                        AND evaluation.currency = ?

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
                supplierId,
                currency
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void insertEvaluation(
            UUID evaluationId,
            UUID supplierId,
            String currency,
            SupplierRiskScoreResult score,
            BigDecimal previousScore,
            BigDecimal deltaScore,
            boolean deterioration,
            BigDecimal spendExposure,
            BigDecimal categorySpendShare,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_risk_evaluations (
                    id,
                    supplier_id,
                    currency,
                    overall_score,
                    risk_band,
                    recommendation,
                    previous_score,
                    delta_score,
                    deterioration,
                    spend_exposure,
                    category_spend_share,
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
                    CURRENT_TIMESTAMP
                )
                """,
                evaluationId,
                supplierId,
                currency,
                score.overallScore(),
                score.riskBand()
                        .name(),
                score.recommendation()
                        .name(),
                previousScore,
                deltaScore,
                deterioration,
                spendExposure,
                categorySpendShare,
                currentUserId
        );
    }

    public void insertFactor(
            UUID evaluationId,
            SupplierRiskFactorResult factor
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_risk_evaluation_factors (
                    id,
                    evaluation_id,
                    factor_code,
                    factor_score,
                    weight_pct,
                    contribution,
                    details
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
                """,
                UUID.randomUUID(),
                evaluationId,
                factor.factorCode()
                        .name(),
                factor.factorScore(),
                factor.weightPct(),
                factor.contribution(),
                factor.details()
        );
    }

    public List<EvaluationRow> latestEvaluations(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT DISTINCT ON (
                    evaluation.supplier_id
                )
                    evaluation.id,
                    evaluation.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.category,
                    supplier.country,

                    evaluation.currency,
                    evaluation.overall_score,
                    evaluation.risk_band,
                    evaluation.recommendation,
                    evaluation.previous_score,
                    evaluation.delta_score,
                    evaluation.deterioration,
                    evaluation.spend_exposure,
                    evaluation.category_spend_share,
                    evaluation.evaluated_at

                FROM supplier_risk_evaluations
                    evaluation

                JOIN suppliers supplier
                    ON supplier.id =
                       evaluation.supplier_id

                WHERE evaluation.currency = ?

                AND supplier.status =
                    'ACTIVE'

                ORDER BY
                    evaluation.supplier_id,
                    evaluation.evaluated_at DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEvaluation(
                                resultSet
                        ),
                currency
        );
    }

    public List<EvaluationRow> evaluationHistory(
            UUID supplierId,
            String currency
    ) {
        return jdbcTemplate.query(
                evaluationSql()
                        + """
                        WHERE evaluation.supplier_id = ?
                        AND evaluation.currency = ?

                        ORDER BY
                            evaluation.evaluated_at DESC

                        LIMIT 24
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEvaluation(
                                resultSet
                        ),
                supplierId,
                currency
        );
    }

    public List<FactorRow> factors(
            UUID evaluationId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    factor_code,
                    factor_score,
                    weight_pct,
                    contribution,
                    details

                FROM supplier_risk_evaluation_factors

                WHERE evaluation_id = ?

                ORDER BY
                    contribution DESC,
                    factor_code
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new FactorRow(
                                SupplierRiskFactorCode.valueOf(
                                        resultSet.getString(
                                                "factor_code"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "factor_score"
                                ),
                                resultSet.getBigDecimal(
                                        "weight_pct"
                                ),
                                resultSet.getBigDecimal(
                                        "contribution"
                                ),
                                resultSet.getString(
                                        "details"
                                )
                        ),
                evaluationId
        );
    }

    public WatchlistRow activeWatchlist(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                watchlistSql()
                        + """
                        WHERE watchlist.supplier_id = ?
                        AND watchlist.status =
                            'ACTIVE'
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapWatchlist(
                                resultSet
                        ),
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void activateWatchlist(
            UUID supplierId,
            UUID currentUserId,
            String reason
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_risk_watchlist (
                    id,
                    supplier_id,
                    status,
                    reason,
                    added_by_user_id,
                    added_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    'ACTIVE',
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )

                ON CONFLICT (
                    supplier_id
                )

                DO UPDATE SET
                    status =
                        'ACTIVE',
                    reason =
                        EXCLUDED.reason,
                    added_by_user_id =
                        EXCLUDED.added_by_user_id,
                    added_at =
                        CURRENT_TIMESTAMP,
                    released_by_user_id =
                        NULL,
                    release_note =
                        NULL,
                    released_at =
                        NULL,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        supplier_risk_watchlist.version
                        + 1
                """,
                UUID.randomUUID(),
                supplierId,
                reason.trim(),
                currentUserId
        );
    }

    public void releaseWatchlist(
            UUID supplierId,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_risk_watchlist
                SET
                    status =
                        'RELEASED',
                    released_by_user_id = ?,
                    release_note = ?,
                    released_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE supplier_id = ?
                AND status =
                    'ACTIVE'
                """,
                currentUserId,
                note.trim(),
                supplierId
        );
    }

    public AlertRow findAlertByKey(
            String alertKey
    ) {
        return jdbcTemplate.query(
                alertSql()
                        + """
                        WHERE alert.alert_key = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAlert(
                                resultSet
                        ),
                alertKey
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public AlertRow findAlert(
            UUID alertId
    ) {
        return jdbcTemplate.query(
                alertSql()
                        + """
                        WHERE alert.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAlert(
                                resultSet
                        ),
                alertId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void upsertAlert(
            UUID alertId,
            String alertKey,
            UUID supplierId,
            UUID evaluationId,
            SupplierRiskAlertType alertType,
            SupplierRiskAlertSeverity severity,
            String title,
            String details
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_risk_alerts (
                    id,
                    alert_key,
                    supplier_id,
                    evaluation_id,
                    alert_type,
                    severity,
                    status,
                    title,
                    details,
                    created_at,
                    last_seen_at,
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
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )

                ON CONFLICT (
                    alert_key
                )

                DO UPDATE SET
                    evaluation_id =
                        EXCLUDED.evaluation_id,
                    severity =
                        EXCLUDED.severity,
                    title =
                        EXCLUDED.title,
                    details =
                        EXCLUDED.details,

                    status =
                        CASE
                            WHEN supplier_risk_alerts.status =
                                'ACKNOWLEDGED'
                            THEN 'ACKNOWLEDGED'
                            ELSE 'OPEN'
                        END,

                    acknowledged_by_user_id =
                        CASE
                            WHEN supplier_risk_alerts.status =
                                'ACKNOWLEDGED'
                            THEN supplier_risk_alerts.acknowledged_by_user_id
                            ELSE NULL
                        END,

                    acknowledgement_note =
                        CASE
                            WHEN supplier_risk_alerts.status =
                                'ACKNOWLEDGED'
                            THEN supplier_risk_alerts.acknowledgement_note
                            ELSE NULL
                        END,

                    acknowledged_at =
                        CASE
                            WHEN supplier_risk_alerts.status =
                                'ACKNOWLEDGED'
                            THEN supplier_risk_alerts.acknowledged_at
                            ELSE NULL
                        END,

                    resolved_at =
                        NULL,

                    last_seen_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        supplier_risk_alerts.version
                        + 1
                """,
                alertId,
                alertKey,
                supplierId,
                evaluationId,
                alertType.name(),
                severity.name(),
                title,
                details
        );
    }

    public int resolveAlert(
            String alertKey
    ) {
        return jdbcTemplate.update(
                """
                UPDATE supplier_risk_alerts
                SET
                    status =
                        'RESOLVED',
                    resolved_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE alert_key = ?
                AND status IN (
                    'OPEN',
                    'ACKNOWLEDGED'
                )
                """,
                alertKey
        );
    }

    public void acknowledgeAlert(
            UUID alertId,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_risk_alerts
                SET
                    status =
                        'ACKNOWLEDGED',
                    acknowledged_by_user_id = ?,
                    acknowledgement_note = ?,
                    acknowledged_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'OPEN'
                """,
                currentUserId,
                note.trim(),
                alertId
        );
    }

    public List<AlertRow> activeAlerts(
            String currency
    ) {
        return jdbcTemplate.query(
                alertSql()
                        + """
                        JOIN supplier_risk_evaluations
                            evaluation_filter
                            ON evaluation_filter.id =
                               alert.evaluation_id

                        WHERE evaluation_filter.currency = ?

                        AND alert.status IN (
                            'OPEN',
                            'ACKNOWLEDGED'
                        )

                        ORDER BY
                            CASE alert.severity
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                ELSE 3
                            END,
                            alert.last_seen_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAlert(
                                resultSet
                        ),
                currency
        );
    }

    public List<AlertRow> alertsForSupplier(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                alertSql()
                        + """
                        WHERE alert.supplier_id = ?

                        ORDER BY
                            CASE alert.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'ACKNOWLEDGED'
                                THEN 2
                                ELSE 3
                            END,
                            alert.last_seen_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAlert(
                                resultSet
                        ),
                supplierId
        );
    }

    public void createEscalation(
            UUID caseId,
            String caseNumber,
            UUID supplierId,
            SupplierRiskEscalationInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_risk_escalation_cases (
                    id,
                    case_number,
                    supplier_id,
                    alert_id,
                    owner_user_id,
                    priority,
                    status,
                    due_date,
                    rationale,
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
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                caseId,
                caseNumber,
                supplierId,
                input.alertId(),
                ownerUserId,
                input.priority()
                        .name(),
                input.dueDate(),
                input.rationale()
                        .trim()
        );
    }

    public EscalationRow findEscalation(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                escalationSql()
                        + """
                        WHERE escalation.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEscalation(
                                resultSet
                        ),
                caseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<EscalationRow> escalationsForSupplier(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                escalationSql()
                        + """
                        WHERE escalation.supplier_id = ?

                        ORDER BY
                            CASE escalation.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'IN_PROGRESS'
                                THEN 2
                                WHEN 'CLOSED'
                                THEN 3
                                ELSE 4
                            END,
                            escalation.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEscalation(
                                resultSet
                        ),
                supplierId
        );
    }

    public void startEscalation(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_risk_escalation_cases
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
                caseId
        );
    }

    public void closeEscalation(
            UUID caseId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_risk_escalation_cases
                SET
                    status =
                        'CLOSED',
                    resolution_note = ?,
                    closed_at =
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
                caseId
        );
    }

    public void cancelEscalation(
            UUID caseId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_risk_escalation_cases
                SET
                    status =
                        'CANCELLED',
                    resolution_note = ?,
                    closed_at =
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
                caseId
        );
    }

    public List<SupplierRiskUserOptionResponse> users() {
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
                        new SupplierRiskUserOptionResponse(
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

    public SupplierIdentityRow supplierIdentity(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name,
                    category,
                    country
                FROM suppliers
                WHERE id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SupplierIdentityRow(
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
                                )
                        ),
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    private String evaluationSql() {
        return """
                SELECT
                    evaluation.id,
                    evaluation.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.category,
                    supplier.country,

                    evaluation.currency,
                    evaluation.overall_score,
                    evaluation.risk_band,
                    evaluation.recommendation,
                    evaluation.previous_score,
                    evaluation.delta_score,
                    evaluation.deterioration,
                    evaluation.spend_exposure,
                    evaluation.category_spend_share,
                    evaluation.evaluated_at

                FROM supplier_risk_evaluations
                    evaluation

                JOIN suppliers supplier
                    ON supplier.id =
                       evaluation.supplier_id

                """;
    }

    private String watchlistSql() {
        return """
                SELECT
                    watchlist.id,
                    watchlist.supplier_id,
                    watchlist.status,
                    watchlist.reason,

                    added_by.full_name
                        AS added_by_name,

                    watchlist.added_at,

                    released_by.full_name
                        AS released_by_name,

                    watchlist.release_note,
                    watchlist.released_at

                FROM supplier_risk_watchlist
                    watchlist

                JOIN app_users added_by
                    ON added_by.id =
                       watchlist.added_by_user_id

                LEFT JOIN app_users released_by
                    ON released_by.id =
                       watchlist.released_by_user_id

                """;
    }

    private String alertSql() {
        return """
                SELECT
                    alert.id,
                    alert.supplier_id,
                    alert.evaluation_id,
                    alert.alert_type,
                    alert.severity,
                    alert.status,
                    alert.title,
                    alert.details,

                    acknowledger.full_name
                        AS acknowledged_by_name,

                    alert.acknowledgement_note,
                    alert.acknowledged_at,
                    alert.resolved_at,
                    alert.created_at,
                    alert.last_seen_at

                FROM supplier_risk_alerts
                    alert

                LEFT JOIN app_users acknowledger
                    ON acknowledger.id =
                       alert.acknowledged_by_user_id

                """;
    }

    private String escalationSql() {
        return """
                SELECT
                    escalation.id,
                    escalation.case_number,
                    escalation.supplier_id,
                    escalation.alert_id,
                    escalation.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    escalation.priority,
                    escalation.status,
                    escalation.due_date,
                    escalation.rationale,
                    escalation.resolution_note,
                    escalation.closed_at,
                    escalation.created_at,
                    escalation.updated_at,
                    escalation.version

                FROM supplier_risk_escalation_cases
                    escalation

                JOIN app_users owner
                    ON owner.id =
                       escalation.owner_user_id

                """;
    }

    private EvaluationRow mapEvaluation(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new EvaluationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                resultSet.getString(
                        "supplier_code"
                ),
                resultSet.getString(
                        "supplier_name"
                ),
                resultSet.getString(
                        "category"
                ),
                resultSet.getString(
                        "country"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getBigDecimal(
                        "overall_score"
                ),
                SupplierContinuousRiskBand.valueOf(
                        resultSet.getString(
                                "risk_band"
                        )
                ),
                SupplierRiskRecommendation.valueOf(
                        resultSet.getString(
                                "recommendation"
                        )
                ),
                resultSet.getBigDecimal(
                        "previous_score"
                ),
                resultSet.getBigDecimal(
                        "delta_score"
                ),
                resultSet.getBoolean(
                        "deterioration"
                ),
                resultSet.getBigDecimal(
                        "spend_exposure"
                ),
                resultSet.getBigDecimal(
                        "category_spend_share"
                ),
                resultSet.getTimestamp(
                        "evaluated_at"
                )
                        .toInstant()
        );
    }

    private WatchlistRow mapWatchlist(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp released =
                resultSet.getTimestamp(
                        "released_at"
                );

        return new WatchlistRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                SupplierRiskWatchlistStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "reason"
                ),
                resultSet.getString(
                        "added_by_name"
                ),
                resultSet.getTimestamp(
                        "added_at"
                )
                        .toInstant(),
                resultSet.getString(
                        "released_by_name"
                ),
                resultSet.getString(
                        "release_note"
                ),
                released == null
                        ? null
                        : released.toInstant()
        );
    }

    private AlertRow mapAlert(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp acknowledged =
                resultSet.getTimestamp(
                        "acknowledged_at"
                );

        Timestamp resolved =
                resultSet.getTimestamp(
                        "resolved_at"
                );

        return new AlertRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "evaluation_id",
                        UUID.class
                ),
                SupplierRiskAlertType.valueOf(
                        resultSet.getString(
                                "alert_type"
                        )
                ),
                SupplierRiskAlertSeverity.valueOf(
                        resultSet.getString(
                                "severity"
                        )
                ),
                SupplierRiskAlertStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "details"
                ),
                resultSet.getString(
                        "acknowledged_by_name"
                ),
                resultSet.getString(
                        "acknowledgement_note"
                ),
                acknowledged == null
                        ? null
                        : acknowledged.toInstant(),
                resolved == null
                        ? null
                        : resolved.toInstant(),
                resultSet.getTimestamp(
                        "created_at"
                )
                        .toInstant(),
                resultSet.getTimestamp(
                        "last_seen_at"
                )
                        .toInstant()
        );
    }

    private EscalationRow mapEscalation(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp closed =
                resultSet.getTimestamp(
                        "closed_at"
                );

        return new EscalationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "case_number"
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "alert_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                SupplierRiskEscalationPriority.valueOf(
                        resultSet.getString(
                                "priority"
                        )
                ),
                SupplierRiskEscalationStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                resultSet.getString(
                        "rationale"
                ),
                resultSet.getString(
                        "resolution_note"
                ),
                closed == null
                        ? null
                        : closed.toInstant(),
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

    public record SupplierBaselineRow(
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String category,
            String country,
            BigDecimal spendExposure,
            BigDecimal categorySpendShare
    ) {
    }

    public record OnboardingSignalRow(
            String status,
            boolean activationClearance,
            LocalDate requalificationDueDate
    ) {
    }

    public record DocumentSignalRow(
            int mandatoryDocuments,
            int currentDocuments,
            int submittedDocuments,
            int expiredDocuments,
            int rejectedDocuments
    ) {
    }

    public record EsgSignalRow(
            String status,
            String rating,
            LocalDate nextReviewDate
    ) {
    }

    public record AnomalySignalRow(
            long activeFindings,
            long criticalFindings,
            BigDecimal maximumScore
    ) {
    }

    public record CollaborationSignalRow(
            long waitingSupplier,
            long slaBreaches,
            long overdueActions
    ) {
    }

    public record CommercialSignalRow(
            long openFindings,
            BigDecimal exposure
    ) {
    }

    public record EvaluationRow(
            UUID id,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String category,
            String country,
            String currency,
            BigDecimal overallScore,
            SupplierContinuousRiskBand riskBand,
            SupplierRiskRecommendation recommendation,
            BigDecimal previousScore,
            BigDecimal deltaScore,
            boolean deterioration,
            BigDecimal spendExposure,
            BigDecimal categorySpendShare,
            Instant evaluatedAt
    ) {
    }

    public record FactorRow(
            SupplierRiskFactorCode factorCode,
            BigDecimal factorScore,
            BigDecimal weightPct,
            BigDecimal contribution,
            String details
    ) {
    }

    public record WatchlistRow(
            UUID id,
            UUID supplierId,
            SupplierRiskWatchlistStatus status,
            String reason,
            String addedByName,
            Instant addedAt,
            String releasedByName,
            String releaseNote,
            Instant releasedAt
    ) {
    }

    public record AlertRow(
            UUID id,
            UUID supplierId,
            UUID evaluationId,
            SupplierRiskAlertType alertType,
            SupplierRiskAlertSeverity severity,
            SupplierRiskAlertStatus status,
            String title,
            String details,
            String acknowledgedByName,
            String acknowledgementNote,
            Instant acknowledgedAt,
            Instant resolvedAt,
            Instant createdAt,
            Instant lastSeenAt
    ) {
    }

    public record EscalationRow(
            UUID id,
            String caseNumber,
            UUID supplierId,
            UUID alertId,
            UUID ownerUserId,
            String ownerName,
            SupplierRiskEscalationPriority priority,
            SupplierRiskEscalationStatus status,
            LocalDate dueDate,
            String rationale,
            String resolutionNote,
            Instant closedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record SupplierIdentityRow(
            UUID id,
            String supplierCode,
            String supplierName,
            String category,
            String country
    ) {
    }
}
