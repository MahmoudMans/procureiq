package com.procureiq.controltower;

import com.procureiq.user.ProcurementRole;
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
public class ControlTowerRepository {

    private final JdbcTemplate jdbcTemplate;

    public ControlTowerRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public void createRun(
            UUID runId,
            String currency,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_control_tower_runs (
                    id,
                    currency,
                    status,
                    started_by_user_id,
                    started_at
                )
                VALUES (
                    ?,
                    ?,
                    'RUNNING',
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                runId,
                currency,
                currentUserId
        );
    }

    public void completeRun(
            UUID runId,
            int discovered,
            int refreshed,
            int autoResolved
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_control_tower_runs
                SET
                    status =
                        'COMPLETED',
                    discovered_count = ?,
                    refreshed_count = ?,
                    auto_resolved_count = ?,
                    completed_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                discovered,
                refreshed,
                autoResolved,
                runId
        );
    }

    public RunRow latestRun(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    run.id,
                    run.currency,
                    run.status,

                    user_account.full_name
                        AS started_by_name,

                    run.discovered_count,
                    run.refreshed_count,
                    run.auto_resolved_count,
                    run.started_at,
                    run.completed_at

                FROM procurement_control_tower_runs
                    run

                JOIN app_users
                    user_account
                    ON user_account.id =
                       run.started_by_user_id

                WHERE run.currency = ?

                ORDER BY
                    run.started_at DESC

                LIMIT 1
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new RunRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getString(
                                        "started_by_name"
                                ),
                                resultSet.getInt(
                                        "discovered_count"
                                ),
                                resultSet.getInt(
                                        "refreshed_count"
                                ),
                                resultSet.getInt(
                                        "auto_resolved_count"
                                ),
                                resultSet.getTimestamp(
                                        "started_at"
                                )
                                        .toInstant(),
                                instant(
                                        resultSet,
                                        "completed_at"
                                )
                        ),
                currency
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ControlTowerSourceException> sourceExceptions(
            String currency
    ) {
        List<ControlTowerSourceException> rows =
                new ArrayList<>();

        rows.addAll(
                supplierRiskAlerts(
                        currency
                )
        );

        rows.addAll(
                overdueRiskEscalations(
                        currency
                )
        );

        rows.addAll(
                documentComplianceGaps(
                        currency
                )
        );

        rows.addAll(
                overdueSourcingInitiatives(
                        currency
                )
        );

        rows.addAll(
                pendingBenefitValidations(
                        currency
                )
        );

        rows.addAll(
                benefitLeakage(
                        currency
                )
        );

        rows.addAll(
                overdueGovernanceDecisions(
                        currency
                )
        );

        rows.addAll(
                overdueGovernanceActions(
                        currency
                )
        );

        rows.addAll(
                commercialLeakage(
                        currency
                )
        );

        return rows;
    }

    private List<ControlTowerSourceException> supplierRiskAlerts(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    alert.id,
                    alert.supplier_id,
                    supplier.supplier_code,
                    supplier.legal_name,
                    alert.alert_type,
                    alert.severity,
                    alert.title,
                    alert.details

                FROM supplier_risk_alerts
                    alert

                JOIN supplier_risk_evaluations
                    evaluation
                    ON evaluation.id =
                       alert.evaluation_id

                JOIN suppliers supplier
                    ON supplier.id =
                       alert.supplier_id

                WHERE
                    evaluation.currency = ?

                AND alert.status IN (
                    'OPEN',
                    'ACKNOWLEDGED'
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID alertId =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    UUID supplierId =
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            );

                    return new ControlTowerSourceException(
                            "SUPPLIER_RISK_ALERT:"
                                    + alertId,
                            ControlTowerExceptionType.SUPPLIER_RISK_ALERT,
                            "SUPPLIER",
                            supplierId,
                            resultSet.getString(
                                    "supplier_code"
                            ),
                            resultSet.getString(
                                    "title"
                            ),
                            resultSet.getString(
                                    "legal_name"
                            )
                                    + " · "
                                    + resultSet.getString(
                                            "alert_type"
                                    )
                                    + " · "
                                    + resultSet.getString(
                                            "details"
                                    ),
                            severity(
                                    resultSet.getString(
                                            "severity"
                                    )
                            ),
                            BigDecimal.ZERO,
                            null
                    );
                },
                currency
        );
    }

    private List<ControlTowerSourceException> overdueRiskEscalations(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    escalation.id,
                    escalation.supplier_id,
                    escalation.case_number,
                    escalation.priority,
                    escalation.due_date,
                    escalation.rationale,

                    supplier.supplier_code,
                    supplier.legal_name

                FROM supplier_risk_escalation_cases
                    escalation

                JOIN suppliers supplier
                    ON supplier.id =
                       escalation.supplier_id

                WHERE
                    escalation.status IN (
                        'OPEN',
                        'IN_PROGRESS'
                    )

                AND escalation.due_date
                    < CURRENT_DATE

                AND EXISTS (
                    SELECT 1

                    FROM supplier_risk_evaluations
                        evaluation

                    WHERE
                        evaluation.supplier_id =
                            escalation.supplier_id

                    AND evaluation.currency = ?
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID escalationId =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    UUID supplierId =
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            );

                    return new ControlTowerSourceException(
                            "RISK_ESCALATION_OVERDUE:"
                                    + escalationId,
                            ControlTowerExceptionType.RISK_ESCALATION_OVERDUE,
                            "SUPPLIER_RISK_ESCALATION",
                            escalationId,
                            resultSet.getString(
                                    "case_number"
                            ),
                            "Overdue supplier-risk escalation",
                            resultSet.getString(
                                    "legal_name"
                            )
                                    + " · "
                                    + resultSet.getString(
                                            "rationale"
                                    ),
                            severity(
                                    resultSet.getString(
                                            "priority"
                                    )
                            ),
                            BigDecimal.ZERO,
                            resultSet.getObject(
                                    "due_date",
                                    LocalDate.class
                            )
                    );
                },
                currency
        );
    }

    private List<ControlTowerSourceException> documentComplianceGaps(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    supplier.id
                        AS supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name,

                    requirement.id
                        AS requirement_id,

                    latest.status
                        AS document_status,

                    latest.expiry_date,

                    COALESCE(
                        po_spend.spend,
                        0
                    )
                        AS spend_exposure

                FROM suppliers supplier

                JOIN supplier_document_requirements
                    requirement
                    ON requirement.active =
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

                LEFT JOIN supplier_compliance_documents
                    document
                    ON document.supplier_id =
                       supplier.id

                    AND document.requirement_id =
                       requirement.id

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

                LEFT JOIN LATERAL (
                    SELECT
                        SUM(
                            purchase_order.total_amount
                        )
                            AS spend

                    FROM purchase_orders
                        purchase_order

                    WHERE
                        purchase_order.supplier_id =
                            supplier.id

                    AND purchase_order.currency = ?

                    AND purchase_order.status
                        <> 'CANCELLED'
                )
                    po_spend
                    ON TRUE

                WHERE supplier.status =
                    'ACTIVE'

                AND COALESCE(
                    po_spend.spend,
                    0
                ) > 0

                AND (
                    latest.status
                        IS NULL

                    OR latest.status
                        <> 'VALID'

                    OR (
                        latest.expiry_date
                            IS NOT NULL

                        AND latest.expiry_date
                            < CURRENT_DATE
                    )
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID supplierId =
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            );

                    UUID requirementId =
                            resultSet.getObject(
                                    "requirement_id",
                                    UUID.class
                            );

                    String documentStatus =
                            resultSet.getString(
                                    "document_status"
                            );

                    LocalDate expiry =
                            resultSet.getObject(
                                    "expiry_date",
                                    LocalDate.class
                            );

                    boolean expired =
                            expiry != null
                                    &&
                                    expiry.isBefore(
                                            LocalDate.now()
                                    );

                    boolean rejected =
                            "REJECTED".equals(
                                    documentStatus
                            );

                    ControlTowerSeverity severity =
                            (
                                    expired
                                    ||
                                    rejected
                            )
                                    ? ControlTowerSeverity.HIGH
                                    : ControlTowerSeverity.MEDIUM;

                    String effectiveStatus;

                    if (expired) {
                        effectiveStatus =
                                "EXPIRED";
                    } else if (
                            documentStatus
                                    == null
                    ) {
                        effectiveStatus =
                                "MISSING";
                    } else {
                        effectiveStatus =
                                documentStatus;
                    }

                    return new ControlTowerSourceException(
                            "DOCUMENT_COMPLIANCE_GAP:"
                                    + supplierId
                                    + ":"
                                    + requirementId,
                            ControlTowerExceptionType.DOCUMENT_COMPLIANCE_GAP,
                            "SUPPLIER",
                            supplierId,
                            resultSet.getString(
                                    "supplier_code"
                            ),
                            "Mandatory supplier document gap",
                            resultSet.getString(
                                    "legal_name"
                            )
                                    + " · Requirement "
                                    + requirementId
                                    + " · Effective status "
                                    + effectiveStatus
                                    + ".",
                            severity,
                            resultSet.getBigDecimal(
                                    "spend_exposure"
                            ),
                            expired
                                    ? expiry
                                    : null
                    );
                },
                currency
        );
    }

    private List<ControlTowerSourceException> overdueSourcingInitiatives(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    initiative.id,
                    initiative.initiative_number,
                    initiative.title,
                    initiative.description,
                    initiative.priority,
                    initiative.planned_end_date,
                    initiative.target_savings,
                    strategy.category_name

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

                AND initiative.planned_end_date
                    IS NOT NULL

                AND initiative.planned_end_date
                    < CURRENT_DATE
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID initiativeId =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    String description =
                            resultSet.getString(
                                    "description"
                            );

                    return new ControlTowerSourceException(
                            "SOURCING_INITIATIVE_OVERDUE:"
                                    + initiativeId,
                            ControlTowerExceptionType.SOURCING_INITIATIVE_OVERDUE,
                            "CATEGORY_INITIATIVE",
                            initiativeId,
                            resultSet.getString(
                                    "initiative_number"
                            ),
                            "Overdue sourcing initiative — "
                                    + resultSet.getString(
                                            "title"
                                    ),
                            resultSet.getString(
                                    "category_name"
                            )
                                    + (
                                            description == null
                                                    ||
                                                    description.isBlank()
                                                    ? ""
                                                    : " · "
                                                            + description
                                    ),
                            severity(
                                    resultSet.getString(
                                            "priority"
                                    )
                            ),
                            resultSet.getBigDecimal(
                                    "target_savings"
                            ),
                            resultSet.getObject(
                                    "planned_end_date",
                                    LocalDate.class
                            )
                    );
                },
                currency
        );
    }

    private List<ControlTowerSourceException> pendingBenefitValidations(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    item.id,
                    item.initiative_number_snapshot,
                    item.initiative_title_snapshot,
                    item.validation_requested_amount,
                    item.forecast_savings,
                    item.expected_realization_date,
                    item.validation_request_note

                FROM procurement_benefit_items
                    item

                JOIN procurement_execution_portfolios
                    portfolio
                    ON portfolio.id =
                       item.portfolio_id

                WHERE portfolio.currency = ?

                AND portfolio.status IN (
                    'AUTHORIZED',
                    'IN_EXECUTION'
                )

                AND item.status =
                    'VALIDATION_PENDING'
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID itemId =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    LocalDate dueDate =
                            resultSet.getObject(
                                    "expected_realization_date",
                                    LocalDate.class
                            );

                    ControlTowerSeverity severity =
                            dueDate != null
                                    &&
                                    dueDate.isBefore(
                                            LocalDate.now()
                                    )
                                    ? ControlTowerSeverity.HIGH
                                    : ControlTowerSeverity.MEDIUM;

                    BigDecimal requested =
                            resultSet.getBigDecimal(
                                    "validation_requested_amount"
                            );

                    BigDecimal exposure =
                            requested == null
                                    ? resultSet.getBigDecimal(
                                            "forecast_savings"
                                    )
                                    : requested;

                    return new ControlTowerSourceException(
                            "BENEFIT_VALIDATION_PENDING:"
                                    + itemId,
                            ControlTowerExceptionType.BENEFIT_VALIDATION_PENDING,
                            "BENEFIT_ITEM",
                            itemId,
                            resultSet.getString(
                                    "initiative_number_snapshot"
                            ),
                            "Benefit validation awaiting governance",
                            resultSet.getString(
                                    "initiative_title_snapshot"
                            )
                                    + " · "
                                    + value(
                                            resultSet.getString(
                                                    "validation_request_note"
                                            ),
                                            "Validation decision pending."
                                    ),
                            severity,
                            exposure,
                            dueDate
                    );
                },
                currency
        );
    }

    private List<ControlTowerSourceException> benefitLeakage(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    leakage.id,
                    leakage.leakage_type,
                    leakage.amount,
                    leakage.description,
                    leakage.due_date,

                    item.initiative_number_snapshot,
                    item.initiative_title_snapshot

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

                WHERE portfolio.currency = ?

                AND portfolio.status
                    <> 'ARCHIVED'

                AND leakage.status IN (
                    'OPEN',
                    'ACCEPTED'
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID leakageId =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    BigDecimal amount =
                            resultSet.getBigDecimal(
                                    "amount"
                            );

                    LocalDate dueDate =
                            resultSet.getObject(
                                    "due_date",
                                    LocalDate.class
                            );

                    ControlTowerSeverity severity =
                            leakageSeverity(
                                    amount,
                                    dueDate
                            );

                    return new ControlTowerSourceException(
                            "BENEFIT_LEAKAGE:"
                                    + leakageId,
                            ControlTowerExceptionType.BENEFIT_LEAKAGE,
                            "BENEFIT_LEAKAGE",
                            leakageId,
                            resultSet.getString(
                                    "initiative_number_snapshot"
                            ),
                            "Benefit leakage — "
                                    + resultSet.getString(
                                            "initiative_title_snapshot"
                                    ),
                            resultSet.getString(
                                    "leakage_type"
                            )
                                    + " · "
                                    + resultSet.getString(
                                            "description"
                                    ),
                            severity,
                            amount,
                            dueDate
                    );
                },
                currency
        );
    }

    private List<ControlTowerSourceException> overdueGovernanceDecisions(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    decision.id,
                    decision.decision_number,
                    decision.decision_type,
                    decision.title,
                    decision.description,
                    decision.due_date,
                    review.review_number,
                    review.title
                        AS review_title

                FROM procurement_governance_decisions
                    decision

                JOIN procurement_governance_reviews
                    review
                    ON review.id =
                       decision.review_id

                WHERE review.currency = ?

                AND review.status IN (
                    'IN_REVIEW',
                    'CLOSED'
                )

                AND decision.status =
                    'OPEN'

                AND decision.due_date
                    IS NOT NULL

                AND decision.due_date
                    < CURRENT_DATE
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID decisionId =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    return new ControlTowerSourceException(
                            "GOVERNANCE_DECISION_OVERDUE:"
                                    + decisionId,
                            ControlTowerExceptionType.GOVERNANCE_DECISION_OVERDUE,
                            "GOVERNANCE_DECISION",
                            decisionId,
                            resultSet.getString(
                                    "decision_number"
                            ),
                            "Overdue executive decision — "
                                    + resultSet.getString(
                                            "title"
                                    ),
                            resultSet.getString(
                                    "review_number"
                            )
                                    + " · "
                                    + resultSet.getString(
                                            "review_title"
                                    )
                                    + " · "
                                    + resultSet.getString(
                                            "decision_type"
                                    )
                                    + " · "
                                    + resultSet.getString(
                                            "description"
                                    ),
                            ControlTowerSeverity.HIGH,
                            BigDecimal.ZERO,
                            resultSet.getObject(
                                    "due_date",
                                    LocalDate.class
                            )
                    );
                },
                currency
        );
    }

    private List<ControlTowerSourceException> overdueGovernanceActions(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    action.id,
                    action.action_number,
                    action.title,
                    action.description,
                    action.priority,
                    action.due_date,
                    review.review_number,
                    review.title
                        AS review_title

                FROM procurement_governance_actions
                    action

                JOIN procurement_governance_reviews
                    review
                    ON review.id =
                       action.review_id

                WHERE review.currency = ?

                AND review.status IN (
                    'IN_REVIEW',
                    'CLOSED'
                )

                AND action.status IN (
                    'OPEN',
                    'IN_PROGRESS'
                )

                AND action.due_date
                    < CURRENT_DATE
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID actionId =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    String description =
                            resultSet.getString(
                                    "description"
                            );

                    return new ControlTowerSourceException(
                            "GOVERNANCE_ACTION_OVERDUE:"
                                    + actionId,
                            ControlTowerExceptionType.GOVERNANCE_ACTION_OVERDUE,
                            "GOVERNANCE_ACTION",
                            actionId,
                            resultSet.getString(
                                    "action_number"
                            ),
                            "Overdue management action — "
                                    + resultSet.getString(
                                            "title"
                                    ),
                            resultSet.getString(
                                    "review_number"
                            )
                                    + " · "
                                    + resultSet.getString(
                                            "review_title"
                                    )
                                    + (
                                            description == null
                                                    ||
                                                    description.isBlank()
                                                    ? ""
                                                    : " · "
                                                            + description
                                    ),
                            severity(
                                    resultSet.getString(
                                            "priority"
                                    )
                            ),
                            BigDecimal.ZERO,
                            resultSet.getObject(
                                    "due_date",
                                    LocalDate.class
                            )
                    );
                },
                currency
        );
    }

    private List<ControlTowerSourceException> commercialLeakage(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    leakage.id,
                    leakage.supplier_id,
                    leakage.leakage_amount,

                    supplier.supplier_code,
                    supplier.legal_name

                FROM commercial_leakage_findings
                    leakage

                JOIN suppliers supplier
                    ON supplier.id =
                       leakage.supplier_id

                WHERE leakage.currency = ?

                AND leakage.status =
                    'OPEN'
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID leakageId =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    UUID supplierId =
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            );

                    BigDecimal amount =
                            resultSet.getBigDecimal(
                                    "leakage_amount"
                            );

                    return new ControlTowerSourceException(
                            "COMMERCIAL_LEAKAGE:"
                                    + leakageId,
                            ControlTowerExceptionType.COMMERCIAL_LEAKAGE,
                            "COMMERCIAL_LEAKAGE",
                            leakageId,
                            resultSet.getString(
                                    "supplier_code"
                            ),
                            "Commercial leakage exposure — "
                                    + resultSet.getString(
                                            "legal_name"
                                    ),
                            "Open commercial leakage finding linked to supplier "
                                    + resultSet.getString(
                                            "supplier_code"
                                    )
                                    + ".",
                            leakageSeverity(
                                    amount,
                                    null
                            ),
                            amount,
                            null
                    );
                },
                currency
        );
    }

    public boolean itemExists(
            String exceptionKey
    ) {
        Boolean exists =
                jdbcTemplate.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM procurement_control_tower_items
                            WHERE exception_key = ?
                        )
                        """,
                        Boolean.class,
                        exceptionKey
                );

        return Boolean.TRUE.equals(
                exists
        );
    }

    public void upsertItem(
            UUID runId,
            String currency,
            ControlTowerSourceException source,
            ControlTowerPriorityResult priority
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_control_tower_items (
                    id,
                    exception_key,
                    exception_type,
                    source_entity_type,
                    source_entity_id,
                    source_reference,
                    currency,
                    title,
                    details,
                    severity,
                    priority_score,
                    monetary_exposure,
                    source_due_date,
                    sla_due_at,
                    status,
                    first_seen_at,
                    last_seen_at,
                    last_scan_id,
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
                    'OPEN',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )

                ON CONFLICT (
                    exception_key
                )

                DO UPDATE SET
                    exception_type =
                        EXCLUDED.exception_type,

                    source_entity_type =
                        EXCLUDED.source_entity_type,

                    source_entity_id =
                        EXCLUDED.source_entity_id,

                    source_reference =
                        EXCLUDED.source_reference,

                    currency =
                        EXCLUDED.currency,

                    title =
                        EXCLUDED.title,

                    details =
                        EXCLUDED.details,

                    severity =
                        EXCLUDED.severity,

                    priority_score =
                        EXCLUDED.priority_score,

                    monetary_exposure =
                        EXCLUDED.monetary_exposure,

                    source_due_date =
                        EXCLUDED.source_due_date,

                    sla_due_at =
                        CASE
                            WHEN procurement_control_tower_items.status =
                                'RESOLVED'
                            THEN EXCLUDED.sla_due_at

                            ELSE LEAST(
                                procurement_control_tower_items.sla_due_at,
                                EXCLUDED.sla_due_at
                            )
                        END,

                    status =
                        CASE
                            WHEN procurement_control_tower_items.status =
                                'DISMISSED'
                            THEN 'DISMISSED'

                            WHEN procurement_control_tower_items.status =
                                'RESOLVED'
                            THEN 'OPEN'

                            ELSE procurement_control_tower_items.status
                        END,

                    acknowledged_by_user_id =
                        CASE
                            WHEN procurement_control_tower_items.status =
                                'RESOLVED'
                            THEN NULL
                            ELSE procurement_control_tower_items.acknowledged_by_user_id
                        END,

                    acknowledgement_note =
                        CASE
                            WHEN procurement_control_tower_items.status =
                                'RESOLVED'
                            THEN NULL
                            ELSE procurement_control_tower_items.acknowledgement_note
                        END,

                    acknowledged_at =
                        CASE
                            WHEN procurement_control_tower_items.status =
                                'RESOLVED'
                            THEN NULL
                            ELSE procurement_control_tower_items.acknowledged_at
                        END,

                    started_at =
                        CASE
                            WHEN procurement_control_tower_items.status =
                                'RESOLVED'
                            THEN NULL
                            ELSE procurement_control_tower_items.started_at
                        END,

                    resolution_note =
                        CASE
                            WHEN procurement_control_tower_items.status =
                                'RESOLVED'
                            THEN NULL
                            ELSE procurement_control_tower_items.resolution_note
                        END,

                    resolved_by_user_id =
                        CASE
                            WHEN procurement_control_tower_items.status =
                                'RESOLVED'
                            THEN NULL
                            ELSE procurement_control_tower_items.resolved_by_user_id
                        END,

                    resolved_at =
                        CASE
                            WHEN procurement_control_tower_items.status =
                                'RESOLVED'
                            THEN NULL
                            ELSE procurement_control_tower_items.resolved_at
                        END,

                    last_seen_at =
                        CURRENT_TIMESTAMP,

                    last_scan_id =
                        EXCLUDED.last_scan_id,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        procurement_control_tower_items.version
                        + 1
                """,
                UUID.randomUUID(),
                source.exceptionKey(),
                source.exceptionType()
                        .name(),
                source.sourceEntityType(),
                source.sourceEntityId(),
                source.sourceReference(),
                currency,
                source.title(),
                source.details(),
                priority.severity()
                        .name(),
                priority.priorityScore(),
                money(
                        source.monetaryExposure()
                ),
                source.sourceDueDate(),
                Timestamp.from(
                        priority.slaDueAt()
                ),
                runId
        );
    }

    public int autoResolveStale(
            UUID runId,
            String currency
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_control_tower_items
                SET
                    status =
                        'RESOLVED',

                    resolution_note =
                        'Auto-resolved because the underlying source condition cleared during a subsequent control-tower scan.',

                    resolved_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        version + 1

                WHERE currency = ?

                AND status IN (
                    'OPEN',
                    'ACKNOWLEDGED',
                    'IN_PROGRESS'
                )

                AND last_scan_id
                    <> ?
                """,
                currency,
                runId
        );
    }

    public ItemRow findItem(
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

    public List<ItemRow> items(
            String currency
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE item.currency = ?

                        ORDER BY
                            CASE item.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'ACKNOWLEDGED'
                                THEN 2
                                WHEN 'IN_PROGRESS'
                                THEN 3
                                WHEN 'RESOLVED'
                                THEN 4
                                ELSE 5
                            END,

                            item.priority_score DESC,
                            item.sla_due_at,
                            item.last_seen_at DESC

                        LIMIT 500
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        ),
                currency
        );
    }

    public void assignOwner(
            UUID itemId,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_control_tower_items
                SET
                    owner_user_id = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'OPEN',
                    'ACKNOWLEDGED',
                    'IN_PROGRESS'
                )
                """,
                ownerUserId,
                itemId
        );
    }

    public void acknowledge(
            UUID itemId,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_control_tower_items
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
                itemId
        );
    }

    public void start(
            UUID itemId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_control_tower_items
                SET
                    status =
                        'IN_PROGRESS',
                    started_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'OPEN',
                    'ACKNOWLEDGED'
                )
                """,
                itemId
        );
    }

    public void resolve(
            UUID itemId,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_control_tower_items
                SET
                    status =
                        'RESOLVED',
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
                    'ACKNOWLEDGED',
                    'IN_PROGRESS'
                )
                """,
                note.trim(),
                currentUserId,
                itemId
        );
    }

    public void dismiss(
            UUID itemId,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_control_tower_items
                SET
                    status =
                        'DISMISSED',
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
                    'ACKNOWLEDGED',
                    'IN_PROGRESS',
                    'RESOLVED'
                )
                """,
                note.trim(),
                currentUserId,
                itemId
        );
    }

    public List<ControlTowerUserOptionResponse> users() {
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
                        new ControlTowerUserOptionResponse(
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

    private String itemSql() {
        return """
                SELECT
                    item.id,
                    item.exception_key,
                    item.exception_type,
                    item.source_entity_type,
                    item.source_entity_id,
                    item.source_reference,
                    item.currency,
                    item.title,
                    item.details,
                    item.severity,
                    item.priority_score,
                    item.monetary_exposure,
                    item.source_due_date,
                    item.sla_due_at,
                    item.status,
                    item.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    acknowledger.full_name
                        AS acknowledged_by_name,

                    item.acknowledgement_note,
                    item.acknowledged_at,
                    item.started_at,
                    item.resolution_note,

                    resolver.full_name
                        AS resolved_by_name,

                    item.resolved_at,
                    item.first_seen_at,
                    item.last_seen_at,
                    item.version

                FROM procurement_control_tower_items
                    item

                LEFT JOIN app_users owner
                    ON owner.id =
                       item.owner_user_id

                LEFT JOIN app_users acknowledger
                    ON acknowledger.id =
                       item.acknowledged_by_user_id

                LEFT JOIN app_users resolver
                    ON resolver.id =
                       item.resolved_by_user_id

                """;
    }

    private ItemRow mapItem(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ItemRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "exception_key"
                ),
                ControlTowerExceptionType.valueOf(
                        resultSet.getString(
                                "exception_type"
                        )
                ),
                resultSet.getString(
                        "source_entity_type"
                ),
                resultSet.getObject(
                        "source_entity_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_reference"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "details"
                ),
                ControlTowerSeverity.valueOf(
                        resultSet.getString(
                                "severity"
                        )
                ),
                resultSet.getBigDecimal(
                        "priority_score"
                ),
                resultSet.getBigDecimal(
                        "monetary_exposure"
                ),
                resultSet.getObject(
                        "source_due_date",
                        LocalDate.class
                ),
                resultSet.getTimestamp(
                        "sla_due_at"
                )
                        .toInstant(),
                ControlTowerItemStatus.valueOf(
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
                        "acknowledged_by_name"
                ),
                resultSet.getString(
                        "acknowledgement_note"
                ),
                instant(
                        resultSet,
                        "acknowledged_at"
                ),
                instant(
                        resultSet,
                        "started_at"
                ),
                resultSet.getString(
                        "resolution_note"
                ),
                resultSet.getString(
                        "resolved_by_name"
                ),
                instant(
                        resultSet,
                        "resolved_at"
                ),
                resultSet.getTimestamp(
                        "first_seen_at"
                )
                        .toInstant(),
                resultSet.getTimestamp(
                        "last_seen_at"
                )
                        .toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private ControlTowerSeverity severity(
            String value
    ) {
        if (value == null) {
            return ControlTowerSeverity.MEDIUM;
        }

        return switch (
                value
                        .trim()
                        .toUpperCase()
        ) {
            case "CRITICAL" ->
                    ControlTowerSeverity.CRITICAL;

            case "HIGH" ->
                    ControlTowerSeverity.HIGH;

            case "LOW" ->
                    ControlTowerSeverity.LOW;

            default ->
                    ControlTowerSeverity.MEDIUM;
        };
    }

    private ControlTowerSeverity leakageSeverity(
            BigDecimal amount,
            LocalDate dueDate
    ) {
        BigDecimal normalized =
                amount == null
                        ? BigDecimal.ZERO
                        : amount;

        boolean overdue =
                dueDate != null
                        &&
                        dueDate.isBefore(
                                LocalDate.now()
                        );

        if (
                overdue
                &&
                normalized.compareTo(
                        new BigDecimal(
                                "10000.00"
                        )
                ) >= 0
        ) {
            return ControlTowerSeverity.CRITICAL;
        }

        if (
                overdue
                ||
                normalized.compareTo(
                        new BigDecimal(
                                "25000.00"
                        )
                ) >= 0
        ) {
            return ControlTowerSeverity.HIGH;
        }

        return ControlTowerSeverity.MEDIUM;
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        return value == null
                ? BigDecimal.ZERO
                : value;
    }

    private String value(
            String value,
            String fallback
    ) {
        return value == null
                        ||
                        value.isBlank()
                ? fallback
                : value;
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

    public record RunRow(
            UUID id,
            String currency,
            String status,
            String startedByName,
            int discoveredCount,
            int refreshedCount,
            int autoResolvedCount,
            Instant startedAt,
            Instant completedAt
    ) {
    }

    public record ItemRow(
            UUID id,
            String exceptionKey,
            ControlTowerExceptionType exceptionType,
            String sourceEntityType,
            UUID sourceEntityId,
            String sourceReference,
            String currency,
            String title,
            String details,
            ControlTowerSeverity severity,
            BigDecimal priorityScore,
            BigDecimal monetaryExposure,
            LocalDate sourceDueDate,
            Instant slaDueAt,
            ControlTowerItemStatus status,
            UUID ownerUserId,
            String ownerName,
            String acknowledgedByName,
            String acknowledgementNote,
            Instant acknowledgedAt,
            Instant startedAt,
            String resolutionNote,
            String resolvedByName,
            Instant resolvedAt,
            Instant firstSeenAt,
            Instant lastSeenAt,
            long version
    ) {
    }
}
