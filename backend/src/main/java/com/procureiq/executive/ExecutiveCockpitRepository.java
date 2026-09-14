package com.procureiq.executive;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
public class ExecutiveCockpitRepository {

    private final JdbcTemplate jdbcTemplate;

    public ExecutiveCockpitRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public List<RuleRow> rules() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    rule_code,
                    signal_type,
                    nature,
                    title,
                    description,
                    recommendation,
                    default_severity,
                    threshold_value,
                    lookahead_days,
                    enabled,
                    priority
                FROM executive_early_warning_rules
                ORDER BY
                    priority DESC,
                    rule_code
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new RuleRow(
                                resultSet.getLong(
                                        "id"
                                ),
                                resultSet.getString(
                                        "rule_code"
                                ),
                                ExecutiveSignalType.valueOf(
                                        resultSet.getString(
                                                "signal_type"
                                        )
                                ),
                                ExecutiveSignalNature.valueOf(
                                        resultSet.getString(
                                                "nature"
                                        )
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "description"
                                ),
                                resultSet.getString(
                                        "recommendation"
                                ),
                                ExecutiveWarningSeverity.valueOf(
                                        resultSet.getString(
                                                "default_severity"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "threshold_value"
                                ),
                                resultSet.getInt(
                                        "lookahead_days"
                                ),
                                resultSet.getBoolean(
                                        "enabled"
                                ),
                                resultSet.getInt(
                                        "priority"
                                )
                        )
        );
    }

    public RuleRow findRule(
            long ruleId
    ) {
        return rules()
                .stream()
                .filter(
                        rule ->
                                rule.id()
                                        == ruleId
                )
                .findFirst()
                .orElse(null);
    }

    public void updateRule(
            long ruleId,
            ExecutiveRuleUpdateInput input
    ) {
        jdbcTemplate.update(
                """
                UPDATE executive_early_warning_rules
                SET
                    enabled = ?,
                    threshold_value = ?,
                    lookahead_days = ?,
                    default_severity = ?,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                input.enabled(),
                input.thresholdValue(),
                input.lookaheadDays(),
                input.defaultSeverity()
                        .name(),
                ruleId
        );
    }

    public Map<String, AcknowledgementRow> acknowledgements() {
        Map<String, AcknowledgementRow> result =
                new HashMap<>();

        jdbcTemplate.query(
                """
                SELECT
                    acknowledgement.warning_key,
                    acknowledgement.rule_id,
                    acknowledgement.note,
                    acknowledgement.acknowledged_at,

                    user_account.full_name
                        AS acknowledged_by_name

                FROM executive_warning_acknowledgements
                    acknowledgement

                JOIN app_users user_account
                    ON user_account.id =
                       acknowledgement.acknowledged_by_user_id
                """,
                resultSet -> {
                    result.put(
                            resultSet.getString(
                                    "warning_key"
                            ),
                            new AcknowledgementRow(
                                    resultSet.getString(
                                            "warning_key"
                                    ),
                                    resultSet.getLong(
                                            "rule_id"
                                    ),
                                    resultSet.getString(
                                            "note"
                                    ),
                                    resultSet.getTimestamp(
                                            "acknowledged_at"
                                    )
                                            .toInstant(),
                                    resultSet.getString(
                                            "acknowledged_by_name"
                                    )
                            )
                    );
                }
        );

        return result;
    }

    public void acknowledge(
            String warningKey,
            long ruleId,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO executive_warning_acknowledgements (
                    id,
                    warning_key,
                    rule_id,
                    acknowledged_by_user_id,
                    note,
                    acknowledged_at,
                    updated_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )

                ON CONFLICT (
                    warning_key
                )

                DO UPDATE SET
                    rule_id =
                        EXCLUDED.rule_id,
                    acknowledged_by_user_id =
                        EXCLUDED.acknowledged_by_user_id,
                    note =
                        EXCLUDED.note,
                    acknowledged_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP
                """,
                UUID.randomUUID(),
                warningKey,
                ruleId,
                currentUserId,
                note.trim()
        );
    }

    public void unacknowledge(
            String warningKey
    ) {
        jdbcTemplate.update(
                """
                DELETE FROM executive_warning_acknowledgements
                WHERE warning_key = ?
                """,
                warningKey
        );
    }

    public List<SignalCandidate> processBottlenecks(
            BigDecimal ratioThreshold
    ) {
        return jdbcTemplate.query(
                """
                WITH latest AS (
                    SELECT DISTINCT ON (
                        event.entity_type,
                        event.entity_id
                    )
                        event.entity_type,
                        event.entity_id,
                        event.entity_reference,
                        event.status,
                        event.event_at

                    FROM procurement_process_events
                        event

                    ORDER BY
                        event.entity_type,
                        event.entity_id,
                        event.event_at DESC,
                        event.id DESC
                ),

                targeted AS (
                    SELECT
                        latest.*,

                        COALESCE(
                            exact_target.target_hours,
                            default_target.target_hours,
                            72
                        )
                            AS target_hours,

                        (
                            EXTRACT(
                                EPOCH
                                FROM (
                                    CURRENT_TIMESTAMP
                                    -
                                    latest.event_at
                                )
                            )
                            /
                            3600.0
                        )
                            AS age_hours

                    FROM latest

                    LEFT JOIN procurement_process_stage_targets
                        exact_target
                        ON exact_target.entity_type =
                           latest.entity_type
                        AND exact_target.status =
                            UPPER(
                                latest.status
                            )

                    LEFT JOIN procurement_process_stage_targets
                        default_target
                        ON default_target.entity_type =
                           latest.entity_type
                        AND default_target.status =
                            '*'

                    WHERE UPPER(
                        latest.status
                    )
                    NOT IN (
                        'CANCELLED',
                        'CLOSED',
                        'PAID',
                        'RECEIVED',
                        'REJECTED',
                        'COMPLETED',
                        'AWARDED',
                        'WITHDRAWN',
                        'TERMINATED'
                    )
                )

                SELECT
                    entity_type,
                    entity_id,
                    entity_reference,
                    status,
                    event_at,

                    ROUND(
                        age_hours::NUMERIC,
                        2
                    )
                        AS age_hours,

                    target_hours,

                    ROUND(
                        (
                            age_hours
                            /
                            target_hours
                        )::NUMERIC,
                        2
                    )
                        AS target_ratio

                FROM targeted

                WHERE
                    (
                        age_hours
                        /
                        target_hours
                    )
                    >= ?

                ORDER BY
                    target_ratio DESC

                LIMIT 100
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SignalCandidate(
                                resultSet.getObject(
                                        "entity_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "entity_type"
                                ),
                                resultSet.getString(
                                        "entity_reference"
                                ),
                                null,
                                null,
                                resultSet.getBigDecimal(
                                        "target_ratio"
                                ),
                                resultSet.getTimestamp(
                                        "event_at"
                                )
                                        .toInstant(),
                                "Current stage "
                                        + resultSet.getString(
                                                "status"
                                        )
                                        + " has been active for "
                                        + resultSet.getBigDecimal(
                                                "age_hours"
                                        )
                                        + " hours against a "
                                        + resultSet.getInt(
                                                "target_hours"
                                        )
                                        + " hour target.",
                                null
                        ),
                ratioThreshold
        );
    }

    public List<SignalCandidate> overdueInvoices(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    invoice.id,
                    invoice.invoice_number,
                    invoice.total_amount,
                    invoice.currency,
                    invoice.due_date,
                    supplier.legal_name
                        AS supplier_name,

                    CURRENT_DATE
                    -
                    invoice.due_date
                        AS overdue_days

                FROM procurement_invoices invoice

                JOIN suppliers supplier
                    ON supplier.id =
                       invoice.supplier_id

                WHERE invoice.currency = ?

                AND invoice.status
                    NOT IN (
                        'PAID',
                        'CANCELLED'
                    )

                AND invoice.due_date
                    < CURRENT_DATE

                ORDER BY
                    invoice.due_date
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SignalCandidate(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                "INVOICE",
                                resultSet.getString(
                                        "invoice_number"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "total_amount"
                                ),
                                BigDecimal.valueOf(
                                        resultSet.getLong(
                                                "overdue_days"
                                        )
                                ),
                                resultSet.getObject(
                                        "due_date",
                                        java.time.LocalDate.class
                                )
                                        .atStartOfDay(
                                                java.time.ZoneOffset.UTC
                                        )
                                        .toInstant(),
                                "Invoice "
                                        + resultSet.getString(
                                                "invoice_number"
                                        )
                                        + " for "
                                        + resultSet.getString(
                                                "supplier_name"
                                        )
                                        + " is "
                                        + resultSet.getLong(
                                                "overdue_days"
                                        )
                                        + " days overdue.",
                                null
                        ),
                currency
        );
    }

    public List<SignalCandidate> paymentHoldInvoices(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    invoice.id,
                    invoice.invoice_number,
                    invoice.total_amount,
                    invoice.currency,
                    invoice.due_date,
                    invoice.hold_reason,
                    supplier.legal_name
                        AS supplier_name

                FROM procurement_invoices invoice

                JOIN suppliers supplier
                    ON supplier.id =
                       invoice.supplier_id

                WHERE invoice.currency = ?

                AND invoice.payment_hold =
                    TRUE

                AND invoice.status
                    NOT IN (
                        'PAID',
                        'CANCELLED'
                    )

                ORDER BY
                    invoice.total_amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SignalCandidate(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                "INVOICE",
                                resultSet.getString(
                                        "invoice_number"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "total_amount"
                                ),
                                null,
                                resultSet.getObject(
                                        "due_date",
                                        java.time.LocalDate.class
                                )
                                        .atStartOfDay(
                                                java.time.ZoneOffset.UTC
                                        )
                                        .toInstant(),
                                "Payment for "
                                        + resultSet.getString(
                                                "invoice_number"
                                        )
                                        + " / "
                                        + resultSet.getString(
                                                "supplier_name"
                                        )
                                        + " is held. "
                                        + java.util.Objects.toString(
                                                resultSet.getString(
                                                        "hold_reason"
                                                ),
                                                "No hold rationale recorded."
                                        ),
                                null
                        ),
                currency
        );
    }

    public List<SignalCandidate> criticalInvoiceExceptions(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    invoice.id,
                    invoice.invoice_number,
                    invoice.total_amount,
                    invoice.currency,

                    exception.severity,
                    exception.exception_type,
                    exception.variance_amount,
                    exception.detected_at

                FROM invoice_match_exceptions
                    exception

                JOIN procurement_invoices invoice
                    ON invoice.id =
                       exception.invoice_id

                WHERE invoice.currency = ?

                AND exception.status =
                    'OPEN'

                AND exception.severity IN (
                    'HIGH',
                    'CRITICAL'
                )

                ORDER BY
                    CASE exception.severity
                        WHEN 'CRITICAL'
                        THEN 1
                        ELSE 2
                    END,
                    exception.detected_at
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SignalCandidate(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                "INVOICE",
                                resultSet.getString(
                                        "invoice_number"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "variance_amount"
                                ) == null
                                        ? resultSet.getBigDecimal(
                                                "total_amount"
                                        )
                                        : resultSet.getBigDecimal(
                                                "variance_amount"
                                        ),
                                null,
                                resultSet.getTimestamp(
                                        "detected_at"
                                )
                                        .toInstant(),
                                "Open "
                                        + resultSet.getString(
                                                "exception_type"
                                        )
                                        + " exception on invoice "
                                        + resultSet.getString(
                                                "invoice_number"
                                        )
                                        + ".",
                                ExecutiveWarningSeverity.valueOf(
                                        resultSet.getString(
                                                "severity"
                                        )
                                )
                        ),
                currency
        );
    }

    public List<SignalCandidate> commercialLeakage(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    finding.id,
                    finding.source_reference,
                    finding.leakage_amount,
                    finding.currency,
                    finding.finding_type,
                    finding.severity,
                    finding.detected_at,

                    supplier.legal_name
                        AS supplier_name

                FROM commercial_leakage_findings
                    finding

                JOIN suppliers supplier
                    ON supplier.id =
                       finding.supplier_id

                WHERE finding.status =
                    'OPEN'

                AND finding.currency = ?

                ORDER BY
                    finding.leakage_amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SignalCandidate(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                "COMMERCIAL_LEAKAGE",
                                java.util.Objects.toString(
                                        resultSet.getString(
                                                "source_reference"
                                        ),
                                        resultSet.getString(
                                                "supplier_name"
                                        )
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "leakage_amount"
                                ),
                                null,
                                resultSet.getTimestamp(
                                        "detected_at"
                                )
                                        .toInstant(),
                                resultSet.getString(
                                        "finding_type"
                                )
                                        + " exposure for "
                                        + resultSet.getString(
                                                "supplier_name"
                                        )
                                        + ".",
                                ExecutiveWarningSeverity.valueOf(
                                        resultSet.getString(
                                                "severity"
                                        )
                                )
                        ),
                currency
        );
    }

    public List<SignalCandidate> renewalDeadlines(
            String currency,
            int lookaheadDays
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    governance.id,
                    governance.contract_id,
                    governance.currency,
                    governance.baseline_contract_value,
                    governance.notice_deadline,
                    governance.renewal_status,

                    supplier.legal_name
                        AS supplier_name

                FROM contract_commercial_governance
                    governance

                JOIN suppliers supplier
                    ON supplier.id =
                       governance.supplier_id

                WHERE governance.status =
                    'ACTIVE'

                AND governance.currency = ?

                AND governance.renewal_status IN (
                    'UPCOMING',
                    'UNDER_REVIEW'
                )

                AND governance.notice_deadline
                    <= CURRENT_DATE + ?

                ORDER BY
                    governance.notice_deadline
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SignalCandidate(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                "CONTRACT_GOVERNANCE",
                                resultSet.getString(
                                        "supplier_name"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_contract_value"
                                ),
                                BigDecimal.valueOf(
                                        java.time.temporal.ChronoUnit.DAYS
                                                .between(
                                                        java.time.LocalDate.now(
                                                                java.time.ZoneOffset.UTC
                                                        ),
                                                        resultSet.getObject(
                                                                "notice_deadline",
                                                                java.time.LocalDate.class
                                                        )
                                                )
                                ),
                                resultSet.getObject(
                                        "notice_deadline",
                                        java.time.LocalDate.class
                                )
                                        .atStartOfDay(
                                                java.time.ZoneOffset.UTC
                                        )
                                        .toInstant(),
                                "Contract notice deadline for "
                                        + resultSet.getString(
                                                "supplier_name"
                                        )
                                        + " is "
                                        + resultSet.getObject(
                                                "notice_deadline",
                                                java.time.LocalDate.class
                                        )
                                        + "; renewal status is "
                                        + resultSet.getString(
                                                "renewal_status"
                                        )
                                        + ".",
                                null
                        ),
                currency,
                lookaheadDays
        );
    }

    public List<SignalCandidate> overdueCriticalObligations(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    obligation.id,
                    obligation.title,
                    obligation.due_date,

                    governance.currency,
                    governance.baseline_contract_value,

                    supplier.legal_name
                        AS supplier_name

                FROM contract_obligations
                    obligation

                JOIN contract_commercial_governance
                    governance
                    ON governance.id =
                       obligation.governance_id

                JOIN suppliers supplier
                    ON supplier.id =
                       governance.supplier_id

                WHERE governance.currency = ?

                AND governance.status =
                    'ACTIVE'

                AND obligation.status =
                    'OPEN'

                AND obligation.critical =
                    TRUE

                AND obligation.due_date
                    < CURRENT_DATE

                ORDER BY
                    obligation.due_date
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SignalCandidate(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                "CONTRACT_OBLIGATION",
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_contract_value"
                                ),
                                BigDecimal.valueOf(
                                        java.time.temporal.ChronoUnit.DAYS
                                                .between(
                                                        resultSet.getObject(
                                                                "due_date",
                                                                java.time.LocalDate.class
                                                        ),
                                                        java.time.LocalDate.now(
                                                                java.time.ZoneOffset.UTC
                                                        )
                                                )
                                ),
                                resultSet.getObject(
                                        "due_date",
                                        java.time.LocalDate.class
                                )
                                        .atStartOfDay(
                                                java.time.ZoneOffset.UTC
                                        )
                                        .toInstant(),
                                "Critical contract obligation '"
                                        + resultSet.getString(
                                                "title"
                                        )
                                        + "' for "
                                        + resultSet.getString(
                                                "supplier_name"
                                        )
                                        + " is overdue.",
                                ExecutiveWarningSeverity.CRITICAL
                        ),
                currency
        );
    }

    public List<SignalCandidate> supplierCapacityRisk(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    profile.supplier_id,
                    profile.capacity_status,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    COALESCE(
                        SUM(
                            purchase_order.total_amount
                        )
                        FILTER (
                            WHERE
                                purchase_order.status
                                    <> 'CANCELLED'
                            AND purchase_order.currency = ?
                        ),
                        0
                    )
                        AS supplier_spend

                FROM supplier_resilience_profiles
                    profile

                JOIN suppliers supplier
                    ON supplier.id =
                       profile.supplier_id

                LEFT JOIN purchase_orders
                    purchase_order
                    ON purchase_order.supplier_id =
                       supplier.id

                WHERE profile.status =
                    'ACTIVE'

                AND profile.capacity_status IN (
                    'CONSTRAINED',
                    'AT_RISK'
                )

                GROUP BY
                    profile.supplier_id,
                    profile.capacity_status,
                    supplier.supplier_code,
                    supplier.legal_name

                ORDER BY
                    supplier_spend DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SignalCandidate(
                                resultSet.getObject(
                                        "supplier_id",
                                        UUID.class
                                ),
                                "SUPPLIER",
                                resultSet.getString(
                                        "supplier_code"
                                )
                                        + " — "
                                        + resultSet.getString(
                                                "supplier_name"
                                        ),
                                currency,
                                resultSet.getBigDecimal(
                                        "supplier_spend"
                                ),
                                null,
                                null,
                                "Supplier capacity is "
                                        + resultSet.getString(
                                                "capacity_status"
                                        )
                                        + ".",
                                "AT_RISK".equals(
                                        resultSet.getString(
                                                "capacity_status"
                                        )
                                )
                                        ? ExecutiveWarningSeverity.CRITICAL
                                        : ExecutiveWarningSeverity.HIGH
                        ),
                currency
        );
    }

    public List<SignalCandidate> criticalSingleSourceSuppliers(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    profile.supplier_id,
                    profile.criticality,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.category,

                    COALESCE(
                        SUM(
                            purchase_order.total_amount
                        )
                        FILTER (
                            WHERE
                                purchase_order.status
                                    <> 'CANCELLED'
                            AND purchase_order.currency = ?
                        ),
                        0
                    )
                        AS supplier_spend

                FROM supplier_resilience_profiles
                    profile

                JOIN suppliers supplier
                    ON supplier.id =
                       profile.supplier_id

                LEFT JOIN purchase_orders
                    purchase_order
                    ON purchase_order.supplier_id =
                       supplier.id

                WHERE profile.status =
                    'ACTIVE'

                AND profile.criticality IN (
                    'CRITICAL',
                    'STRATEGIC'
                )

                AND NOT EXISTS (
                    SELECT 1
                    FROM suppliers alternate
                    WHERE alternate.id
                        <> supplier.id
                    AND alternate.status =
                        'ACTIVE'
                    AND LOWER(
                        COALESCE(
                            alternate.category,
                            ''
                        )
                    ) =
                        LOWER(
                            COALESCE(
                                supplier.category,
                                ''
                            )
                        )
                )

                GROUP BY
                    profile.supplier_id,
                    profile.criticality,
                    supplier.supplier_code,
                    supplier.legal_name,
                    supplier.category

                ORDER BY
                    supplier_spend DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SignalCandidate(
                                resultSet.getObject(
                                        "supplier_id",
                                        UUID.class
                                ),
                                "SUPPLIER",
                                resultSet.getString(
                                        "supplier_code"
                                )
                                        + " — "
                                        + resultSet.getString(
                                                "supplier_name"
                                        ),
                                currency,
                                resultSet.getBigDecimal(
                                        "supplier_spend"
                                ),
                                null,
                                null,
                                resultSet.getString(
                                        "criticality"
                                )
                                        + " supplier has no active alternate in category "
                                        + java.util.Objects.toString(
                                                resultSet.getString(
                                                        "category"
                                                ),
                                                "Uncategorized"
                                        )
                                        + ".",
                                ExecutiveWarningSeverity.CRITICAL
                        ),
                currency
        );
    }

    public List<SignalCandidate> negotiationTargetMisses(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    negotiation.id,
                    negotiation.negotiation_number,
                    negotiation.currency,
                    negotiation.target_value,
                    negotiation.agreed_value,

                    supplier.legal_name
                        AS supplier_name

                FROM procurement_negotiation_workspaces
                    negotiation

                JOIN suppliers supplier
                    ON supplier.id =
                       negotiation.supplier_id

                WHERE negotiation.currency = ?

                AND negotiation.status IN (
                    'AGREED',
                    'CLOSED'
                )

                AND negotiation.target_value
                    IS NOT NULL

                AND negotiation.agreed_value
                    IS NOT NULL

                AND negotiation.agreed_value
                    >
                    negotiation.target_value

                ORDER BY
                    (
                        negotiation.agreed_value
                        -
                        negotiation.target_value
                    ) DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    BigDecimal delta =
                            resultSet.getBigDecimal(
                                    "agreed_value"
                            )
                                    .subtract(
                                            resultSet.getBigDecimal(
                                                    "target_value"
                                            )
                                    );

                    return new SignalCandidate(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            "NEGOTIATION",
                            resultSet.getString(
                                    "negotiation_number"
                            ),
                            resultSet.getString(
                                    "currency"
                            ),
                            delta,
                            null,
                            null,
                            "Negotiation "
                                    + resultSet.getString(
                                            "negotiation_number"
                                    )
                                    + " for "
                                    + resultSet.getString(
                                            "supplier_name"
                                    )
                                    + " agreed above target by "
                                    + delta
                                    + ".",
                            null
                    );
                },
                currency
        );
    }

    public List<SignalCandidate> delayedDemandBundles(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    bundle.id,
                    bundle.bundle_number,
                    bundle.title,
                    bundle.currency,
                    bundle.expected_savings,
                    bundle.target_sourcing_date

                FROM demand_consolidation_bundles
                    bundle

                WHERE bundle.currency = ?

                AND bundle.status =
                    'APPROVED'

                AND bundle.linked_rfq_id
                    IS NULL

                AND bundle.target_sourcing_date
                    <= CURRENT_DATE

                ORDER BY
                    bundle.target_sourcing_date,
                    bundle.expected_savings DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SignalCandidate(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                "DEMAND_BUNDLE",
                                resultSet.getString(
                                        "bundle_number"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "expected_savings"
                                ),
                                BigDecimal.valueOf(
                                        java.time.temporal.ChronoUnit.DAYS
                                                .between(
                                                        resultSet.getObject(
                                                                "target_sourcing_date",
                                                                java.time.LocalDate.class
                                                        ),
                                                        java.time.LocalDate.now(
                                                                java.time.ZoneOffset.UTC
                                                        )
                                                )
                                ),
                                resultSet.getObject(
                                        "target_sourcing_date",
                                        java.time.LocalDate.class
                                )
                                        .atStartOfDay(
                                                java.time.ZoneOffset.UTC
                                        )
                                        .toInstant(),
                                "Approved demand bundle "
                                        + resultSet.getString(
                                                "bundle_number"
                                        )
                                        + " has reached its target sourcing date without an RFQ linkage.",
                                null
                        ),
                currency
        );
    }

    public List<SignalCandidate> demandSavingsOpportunities(
            String currency,
            BigDecimal threshold
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    bundle.id,
                    bundle.bundle_number,
                    bundle.title,
                    bundle.currency,
                    bundle.expected_savings,
                    bundle.target_sourcing_date,
                    bundle.status

                FROM demand_consolidation_bundles
                    bundle

                WHERE bundle.currency = ?

                AND bundle.status IN (
                    'DRAFT',
                    'UNDER_REVIEW',
                    'APPROVED',
                    'SOURCING'
                )

                AND bundle.expected_savings
                    >= ?

                ORDER BY
                    bundle.expected_savings DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SignalCandidate(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                "DEMAND_BUNDLE",
                                resultSet.getString(
                                        "bundle_number"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "expected_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "expected_savings"
                                ),
                                resultSet.getObject(
                                        "target_sourcing_date",
                                        java.time.LocalDate.class
                                )
                                        .atStartOfDay(
                                                java.time.ZoneOffset.UTC
                                        )
                                        .toInstant(),
                                "Demand bundle "
                                        + resultSet.getString(
                                                "bundle_number"
                                        )
                                        + " has "
                                        + resultSet.getBigDecimal(
                                                "expected_savings"
                                        )
                                        + " expected savings and status "
                                        + resultSet.getString(
                                                "status"
                                        )
                                        + ".",
                                null
                        ),
                currency,
                threshold
        );
    }

    public record RuleRow(
            long id,
            String ruleCode,
            ExecutiveSignalType signalType,
            ExecutiveSignalNature nature,
            String title,
            String description,
            String recommendation,
            ExecutiveWarningSeverity defaultSeverity,
            BigDecimal thresholdValue,
            int lookaheadDays,
            boolean enabled,
            int priority
    ) {
    }

    public record AcknowledgementRow(
            String warningKey,
            long ruleId,
            String note,
            Instant acknowledgedAt,
            String acknowledgedByName
    ) {
    }

    public record SignalCandidate(
            UUID referenceId,
            String referenceType,
            String referenceLabel,
            String currency,
            BigDecimal exposureValue,
            BigDecimal metricValue,
            Instant dueAt,
            String details,
            ExecutiveWarningSeverity severityHint
    ) {
    }
}
