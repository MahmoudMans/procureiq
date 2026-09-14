package com.procureiq.anomaly;

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
public class AnomalyRepository {

    private final JdbcTemplate jdbcTemplate;

    public AnomalyRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextInvestigationSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_investigation_case_number_seq'
                )
                """,
                Long.class
        );
    }

    public List<RuleRow> rules() {
        return jdbcTemplate.query(
                """
                SELECT
                    rule.id,
                    rule.rule_code,
                    rule.signal_type,
                    rule.title,
                    rule.description,
                    rule.default_severity,
                    rule.score_weight,
                    rule.threshold_value,
                    rule.lookback_days,
                    rule.enabled,

                    (
                        SELECT COUNT(*)
                        FROM procurement_anomaly_findings
                            finding
                        WHERE
                            finding.rule_id =
                                rule.id
                        AND finding.status IN (
                            'OPEN',
                            'UNDER_INVESTIGATION'
                        )
                    )
                        AS active_findings

                FROM procurement_anomaly_rules rule

                ORDER BY
                    CASE rule.default_severity
                        WHEN 'CRITICAL'
                        THEN 1
                        WHEN 'HIGH'
                        THEN 2
                        WHEN 'MEDIUM'
                        THEN 3
                        ELSE 4
                    END,
                    rule.rule_code
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
                                AnomalySignalType.valueOf(
                                        resultSet.getString(
                                                "signal_type"
                                        )
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "description"
                                ),
                                AnomalySeverity.valueOf(
                                        resultSet.getString(
                                                "default_severity"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "score_weight"
                                ),
                                resultSet.getBigDecimal(
                                        "threshold_value"
                                ),
                                resultSet.getInt(
                                        "lookback_days"
                                ),
                                resultSet.getBoolean(
                                        "enabled"
                                ),
                                resultSet.getLong(
                                        "active_findings"
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
            AnomalyRuleUpdateInput input
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_anomaly_rules
                SET
                    enabled = ?,
                    default_severity = ?,
                    score_weight = ?,
                    threshold_value = ?,
                    lookback_days = ?,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                input.enabled(),
                input.defaultSeverity()
                        .name(),
                input.scoreWeight(),
                input.thresholdValue(),
                input.lookbackDays(),
                ruleId
        );
    }

    public List<AnomalyCandidate> candidatesForRule(
            RuleRow rule,
            String currency
    ) {
        return switch (
                rule.ruleCode()
        ) {
            case "DUPLICATE_SUPPLIER_INVOICE_REFERENCE" ->
                    duplicateInvoiceReferences(
                            rule,
                            currency
                    );

            case "REPEATED_INVOICE_VALUE_PATTERN" ->
                    repeatedInvoiceValues(
                            rule,
                            currency
                    );

            case "HIGH_VALUE_ROUND_INVOICE" ->
                    roundValueInvoices(
                            rule,
                            currency
                    );

            case "SPLIT_PURCHASE_INDICATOR" ->
                    splitPurchaseIndicators(
                            rule,
                            currency
                    );

            case "SUPPLIER_CATEGORY_CONCENTRATION" ->
                    supplierConcentration(
                            rule,
                            currency
                    );

            case "OPEN_COMMERCIAL_LEAKAGE" ->
                    openCommercialLeakage(
                            rule,
                            currency
                    );

            case "OFF_CONTRACT_BUYING" ->
                    offContractBuying(
                            rule,
                            currency
                    );

            case "REPEATED_PROCESS_STAGE" ->
                    repeatedProcessStages(
                            rule
                    );

            default ->
                    List.of();
        };
    }

    private List<AnomalyCandidate> duplicateInvoiceReferences(
            RuleRow rule,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    invoice.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    LOWER(
                        BTRIM(
                            invoice.supplier_invoice_number
                        )
                    )
                        AS normalized_reference,

                    MIN(
                        invoice.supplier_invoice_number
                    )
                        AS display_reference,

                    COUNT(*)
                        AS occurrence_count,

                    SUM(
                        invoice.total_amount
                    )
                        AS exposure

                FROM procurement_invoices invoice

                JOIN suppliers supplier
                    ON supplier.id =
                       invoice.supplier_id

                WHERE invoice.status
                    <> 'CANCELLED'

                AND invoice.currency = ?

                AND invoice.invoice_date
                    >= CURRENT_DATE - ?

                AND BTRIM(
                    invoice.supplier_invoice_number
                )
                    <> ''

                GROUP BY
                    invoice.supplier_id,
                    supplier.supplier_code,
                    supplier.legal_name,
                    LOWER(
                        BTRIM(
                            invoice.supplier_invoice_number
                        )
                    )

                HAVING COUNT(*)
                    >= ?

                ORDER BY
                    occurrence_count DESC,
                    exposure DESC
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

                    String normalized =
                            resultSet.getString(
                                    "normalized_reference"
                            );

                    long count =
                            resultSet.getLong(
                                    "occurrence_count"
                            );

                    return new AnomalyCandidate(
                            "DUPLICATE_SUPPLIER_INVOICE_REFERENCE:"
                                    + supplierId
                                    + ":"
                                    + normalized,
                            "SUPPLIER_INVOICE_REFERENCE",
                            supplierId,
                            null,
                            resultSet.getString(
                                    "supplier_code"
                            )
                                    + " / "
                                    + resultSet.getString(
                                            "display_reference"
                                    ),
                            currency,
                            resultSet.getBigDecimal(
                                    "exposure"
                            ),
                            BigDecimal.valueOf(
                                    count
                            ),
                            "Supplier "
                                    + resultSet.getString(
                                            "supplier_name"
                                    )
                                    + " has "
                                    + count
                                    + " non-cancelled invoices using supplier invoice reference '"
                                    + resultSet.getString(
                                            "display_reference"
                                    )
                                    + "'."
                    );
                },
                currency,
                rule.lookbackDays(),
                rule.thresholdValue()
                        .intValue()
        );
    }

    private List<AnomalyCandidate> repeatedInvoiceValues(
            RuleRow rule,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    invoice.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    invoice.total_amount,

                    COUNT(*)
                        AS occurrence_count,

                    SUM(
                        invoice.total_amount
                    )
                        AS exposure

                FROM procurement_invoices invoice

                JOIN suppliers supplier
                    ON supplier.id =
                       invoice.supplier_id

                WHERE invoice.status
                    <> 'CANCELLED'

                AND invoice.currency = ?

                AND invoice.invoice_date
                    >= CURRENT_DATE - ?

                GROUP BY
                    invoice.supplier_id,
                    supplier.supplier_code,
                    supplier.legal_name,
                    invoice.total_amount

                HAVING COUNT(*)
                    >= ?

                ORDER BY
                    occurrence_count DESC,
                    exposure DESC
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

                    BigDecimal amount =
                            resultSet.getBigDecimal(
                                    "total_amount"
                            );

                    long count =
                            resultSet.getLong(
                                    "occurrence_count"
                            );

                    return new AnomalyCandidate(
                            "REPEATED_INVOICE_VALUE_PATTERN:"
                                    + supplierId
                                    + ":"
                                    + currency
                                    + ":"
                                    + amount.stripTrailingZeros()
                                            .toPlainString(),
                            "SUPPLIER_INVOICE_VALUE",
                            supplierId,
                            null,
                            resultSet.getString(
                                    "supplier_code"
                            )
                                    + " / "
                                    + amount,
                            currency,
                            resultSet.getBigDecimal(
                                    "exposure"
                            ),
                            BigDecimal.valueOf(
                                    count
                            ),
                            "Supplier "
                                    + resultSet.getString(
                                            "supplier_name"
                                    )
                                    + " has "
                                    + count
                                    + " invoices with exactly the same value "
                                    + amount
                                    + " "
                                    + currency
                                    + " within the configured lookback window."
                    );
                },
                currency,
                rule.lookbackDays(),
                rule.thresholdValue()
                        .intValue()
        );
    }

    private List<AnomalyCandidate> roundValueInvoices(
            RuleRow rule,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    invoice.id,
                    invoice.invoice_number,
                    invoice.total_amount,
                    invoice.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name

                FROM procurement_invoices invoice

                JOIN suppliers supplier
                    ON supplier.id =
                       invoice.supplier_id

                WHERE invoice.status
                    <> 'CANCELLED'

                AND invoice.currency = ?

                AND invoice.invoice_date
                    >= CURRENT_DATE - ?

                AND invoice.total_amount
                    >= ?

                AND MOD(
                    invoice.total_amount,
                    1000
                ) = 0

                ORDER BY
                    invoice.total_amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID invoiceId =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    BigDecimal amount =
                            resultSet.getBigDecimal(
                                    "total_amount"
                            );

                    return new AnomalyCandidate(
                            "HIGH_VALUE_ROUND_INVOICE:"
                                    + invoiceId,
                            "INVOICE",
                            invoiceId,
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "invoice_number"
                            )
                                    + " / "
                                    + resultSet.getString(
                                            "supplier_code"
                                    ),
                            currency,
                            amount,
                            amount,
                            "Invoice "
                                    + resultSet.getString(
                                            "invoice_number"
                                    )
                                    + " from "
                                    + resultSet.getString(
                                            "supplier_name"
                                    )
                                    + " is a high-value exact multiple of 1,000: "
                                    + amount
                                    + " "
                                    + currency
                                    + "."
                    );
                },
                currency,
                rule.lookbackDays(),
                rule.thresholdValue()
        );
    }

    private List<AnomalyCandidate> splitPurchaseIndicators(
            RuleRow rule,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    DATE(
                        purchase_order.created_at
                    )
                        AS order_date,

                    COUNT(*)
                        AS purchase_order_count,

                    SUM(
                        purchase_order.total_amount
                    )
                        AS combined_value,

                    MAX(
                        purchase_order.total_amount
                    )
                        AS maximum_order_value

                FROM purchase_orders
                    purchase_order

                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id

                WHERE purchase_order.status
                    <> 'CANCELLED'

                AND purchase_order.currency = ?

                AND DATE(
                    purchase_order.created_at
                )
                    >= CURRENT_DATE - ?

                GROUP BY
                    purchase_order.supplier_id,
                    supplier.supplier_code,
                    supplier.legal_name,
                    DATE(
                        purchase_order.created_at
                    )

                HAVING COUNT(*)
                    >= 2

                AND MAX(
                    purchase_order.total_amount
                )
                    < ?

                AND SUM(
                    purchase_order.total_amount
                )
                    >= ?

                ORDER BY
                    combined_value DESC
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

                    LocalDate date =
                            resultSet.getObject(
                                    "order_date",
                                    LocalDate.class
                            );

                    long count =
                            resultSet.getLong(
                                    "purchase_order_count"
                            );

                    return new AnomalyCandidate(
                            "SPLIT_PURCHASE_INDICATOR:"
                                    + supplierId
                                    + ":"
                                    + currency
                                    + ":"
                                    + date,
                            "SUPPLIER_DAY_PURCHASE",
                            supplierId,
                            null,
                            resultSet.getString(
                                    "supplier_code"
                            )
                                    + " / "
                                    + date,
                            currency,
                            resultSet.getBigDecimal(
                                    "combined_value"
                            ),
                            BigDecimal.valueOf(
                                    count
                            ),
                            count
                                    + " purchase orders were issued to "
                                    + resultSet.getString(
                                            "supplier_name"
                                    )
                                    + " on "
                                    + date
                                    + ". Each order was below "
                                    + rule.thresholdValue()
                                    + " "
                                    + currency
                                    + ", while the combined value was "
                                    + resultSet.getBigDecimal(
                                            "combined_value"
                                    )
                                    + "."
                    );
                },
                currency,
                rule.lookbackDays(),
                rule.thresholdValue(),
                rule.thresholdValue()
        );
    }

    private List<AnomalyCandidate> supplierConcentration(
            RuleRow rule,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                WITH supplier_spend AS (
                    SELECT
                        purchase_order.supplier_id,

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

                        supplier.supplier_code,
                        supplier.legal_name
                            AS supplier_name,

                        SUM(
                            purchase_order.total_amount
                        )
                            AS supplier_spend

                    FROM purchase_orders
                        purchase_order

                    JOIN suppliers supplier
                        ON supplier.id =
                           purchase_order.supplier_id

                    WHERE purchase_order.status
                        <> 'CANCELLED'

                    AND purchase_order.currency = ?

                    AND DATE(
                        purchase_order.created_at
                    )
                        >= CURRENT_DATE - ?

                    GROUP BY
                        purchase_order.supplier_id,
                        COALESCE(
                            NULLIF(
                                BTRIM(
                                    supplier.category
                                ),
                                ''
                            ),
                            'Uncategorized'
                        ),
                        supplier.supplier_code,
                        supplier.legal_name
                ),

                category_spend AS (
                    SELECT
                        category,

                        SUM(
                            supplier_spend
                        )
                            AS category_total

                    FROM supplier_spend

                    GROUP BY
                        category
                )

                SELECT
                    supplier_spend.supplier_id,
                    supplier_spend.category,
                    supplier_spend.supplier_code,
                    supplier_spend.supplier_name,
                    supplier_spend.supplier_spend,
                    category_spend.category_total,

                    ROUND(
                        (
                            supplier_spend.supplier_spend
                            /
                            NULLIF(
                                category_spend.category_total,
                                0
                            )
                            *
                            100
                        )::NUMERIC,
                        2
                    )
                        AS spend_share

                FROM supplier_spend

                JOIN category_spend
                    ON category_spend.category =
                       supplier_spend.category

                WHERE
                    (
                        supplier_spend.supplier_spend
                        /
                        NULLIF(
                            category_spend.category_total,
                            0
                        )
                        *
                        100
                    )
                    >= ?

                ORDER BY
                    spend_share DESC,
                    supplier_spend.supplier_spend DESC
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

                    BigDecimal share =
                            resultSet.getBigDecimal(
                                    "spend_share"
                            );

                    return new AnomalyCandidate(
                            "SUPPLIER_CATEGORY_CONCENTRATION:"
                                    + supplierId
                                    + ":"
                                    + currency
                                    + ":"
                                    + resultSet.getString(
                                            "category"
                                    ),
                            "SUPPLIER_CATEGORY",
                            supplierId,
                            null,
                            resultSet.getString(
                                    "supplier_code"
                            )
                                    + " / "
                                    + resultSet.getString(
                                            "category"
                                    ),
                            currency,
                            resultSet.getBigDecimal(
                                    "supplier_spend"
                            ),
                            share,
                            "Supplier "
                                    + resultSet.getString(
                                            "supplier_name"
                                    )
                                    + " represents "
                                    + share
                                    + "% of purchase-order spend in category "
                                    + resultSet.getString(
                                            "category"
                                    )
                                    + "."
                    );
                },
                currency,
                rule.lookbackDays(),
                rule.thresholdValue()
        );
    }

    private List<AnomalyCandidate> openCommercialLeakage(
            RuleRow rule,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    finding.id,
                    finding.supplier_id,
                    finding.source_reference,
                    finding.finding_type,
                    finding.leakage_amount,

                    supplier.supplier_code,
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

                AND finding.leakage_amount
                    >= ?

                ORDER BY
                    finding.leakage_amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID findingId =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    return new AnomalyCandidate(
                            "OPEN_COMMERCIAL_LEAKAGE:"
                                    + findingId,
                            "COMMERCIAL_LEAKAGE",
                            findingId,
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            ),
                            java.util.Objects.toString(
                                    resultSet.getString(
                                            "source_reference"
                                    ),
                                    resultSet.getString(
                                            "supplier_code"
                                    )
                            ),
                            currency,
                            resultSet.getBigDecimal(
                                    "leakage_amount"
                            ),
                            resultSet.getBigDecimal(
                                    "leakage_amount"
                            ),
                            "Open "
                                    + resultSet.getString(
                                            "finding_type"
                                    )
                                    + " commercial leakage for supplier "
                                    + resultSet.getString(
                                            "supplier_name"
                                    )
                                    + " has exposure "
                                    + resultSet.getBigDecimal(
                                            "leakage_amount"
                                    )
                                    + " "
                                    + currency
                                    + "."
                    );
                },
                currency,
                rule.thresholdValue()
        );
    }

    private List<AnomalyCandidate> offContractBuying(
            RuleRow rule,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    finding.id,
                    finding.supplier_id,
                    finding.source_reference,
                    finding.leakage_amount,

                    supplier.supplier_code,
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

                AND finding.finding_type =
                    'OFF_CONTRACT'

                ORDER BY
                    finding.leakage_amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID findingId =
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            );

                    return new AnomalyCandidate(
                            "OFF_CONTRACT_BUYING:"
                                    + findingId,
                            "OFF_CONTRACT_TRANSACTION",
                            findingId,
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            ),
                            java.util.Objects.toString(
                                    resultSet.getString(
                                            "source_reference"
                                    ),
                                    resultSet.getString(
                                            "supplier_code"
                                    )
                            ),
                            currency,
                            resultSet.getBigDecimal(
                                    "leakage_amount"
                            ),
                            BigDecimal.ONE,
                            "Off-contract buying indicator remains open for supplier "
                                    + resultSet.getString(
                                            "supplier_name"
                                    )
                                    + "."
                    );
                },
                currency
        );
    }

    private List<AnomalyCandidate> repeatedProcessStages(
            RuleRow rule
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    entity_type,
                    entity_id,
                    status,

                    MAX(
                        entity_reference
                    )
                        AS entity_reference,

                    COUNT(*)
                        AS stage_visits

                FROM procurement_process_events

                WHERE event_source =
                    'LIVE'

                AND event_type =
                    'STATUS_CHANGED'

                AND event_at
                    >= CURRENT_TIMESTAMP
                       -
                       (
                           ? *
                           INTERVAL '1 day'
                       )

                GROUP BY
                    entity_type,
                    entity_id,
                    status

                HAVING COUNT(*)
                    >= ?

                ORDER BY
                    stage_visits DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID entityId =
                            resultSet.getObject(
                                    "entity_id",
                                    UUID.class
                            );

                    long visits =
                            resultSet.getLong(
                                    "stage_visits"
                            );

                    return new AnomalyCandidate(
                            "REPEATED_PROCESS_STAGE:"
                                    + resultSet.getString(
                                            "entity_type"
                                    )
                                    + ":"
                                    + entityId
                                    + ":"
                                    + resultSet.getString(
                                            "status"
                                    ),
                            resultSet.getString(
                                    "entity_type"
                            ),
                            entityId,
                            null,
                            resultSet.getString(
                                    "entity_reference"
                            ),
                            null,
                            null,
                            BigDecimal.valueOf(
                                    visits
                            ),
                            resultSet.getString(
                                    "entity_type"
                            )
                                    + " entity "
                                    + java.util.Objects.toString(
                                            resultSet.getString(
                                                    "entity_reference"
                                            ),
                                            entityId.toString()
                                    )
                                    + " entered process stage "
                                    + resultSet.getString(
                                            "status"
                                    )
                                    + " "
                                    + visits
                                    + " times within the configured lookback period."
                    );
                },
                rule.lookbackDays(),
                rule.thresholdValue()
                        .intValue()
        );
    }

    public FindingRow findFindingByKey(
            String findingKey
    ) {
        return jdbcTemplate.query(
                findingSql()
                        + """
                        WHERE finding.finding_key = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapFinding(
                                resultSet
                        ),
                findingKey
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public FindingRow findFinding(
            UUID findingId
    ) {
        return jdbcTemplate.query(
                findingSql()
                        + """
                        WHERE finding.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapFinding(
                                resultSet
                        ),
                findingId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<FindingRow> findings(
            String currency
    ) {
        return jdbcTemplate.query(
                findingSql()
                        + """
                        WHERE (
                            finding.currency = ?
                            OR finding.currency
                                IS NULL
                        )

                        ORDER BY
                            CASE finding.status
                                WHEN 'UNDER_INVESTIGATION'
                                THEN 1
                                WHEN 'OPEN'
                                THEN 2
                                WHEN 'CONFIRMED'
                                THEN 3
                                WHEN 'RESOLVED'
                                THEN 4
                                ELSE 5
                            END,

                            finding.anomaly_score DESC,
                            finding.last_seen_at DESC

                        LIMIT 750
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapFinding(
                                resultSet
                        ),
                currency
        );
    }

    public List<FindingRow> activeFindingsByRule(
            long ruleId
    ) {
        return jdbcTemplate.query(
                findingSql()
                        + """
                        WHERE finding.rule_id = ?

                        AND finding.status IN (
                            'OPEN',
                            'UNDER_INVESTIGATION'
                        )
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapFinding(
                                resultSet
                        ),
                ruleId
        );
    }

    public void upsertFinding(
            UUID findingId,
            long ruleId,
            AnomalyCandidate candidate,
            BigDecimal anomalyScore
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_anomaly_findings (
                    id,
                    finding_key,
                    rule_id,
                    entity_type,
                    entity_id,
                    related_entity_id,
                    entity_reference,
                    currency,
                    exposure_value,
                    metric_value,
                    anomaly_score,
                    details,
                    status,
                    detected_at,
                    last_seen_at,
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
                    'OPEN',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )

                ON CONFLICT (
                    finding_key
                )

                DO UPDATE SET
                    rule_id =
                        EXCLUDED.rule_id,
                    entity_type =
                        EXCLUDED.entity_type,
                    entity_id =
                        EXCLUDED.entity_id,
                    related_entity_id =
                        EXCLUDED.related_entity_id,
                    entity_reference =
                        EXCLUDED.entity_reference,
                    currency =
                        EXCLUDED.currency,
                    exposure_value =
                        EXCLUDED.exposure_value,
                    metric_value =
                        EXCLUDED.metric_value,
                    anomaly_score =
                        EXCLUDED.anomaly_score,
                    details =
                        EXCLUDED.details,

                    status =
                        CASE
                            WHEN procurement_anomaly_findings.status
                                IN (
                                    'UNDER_INVESTIGATION',
                                    'CONFIRMED',
                                    'DISMISSED'
                                )
                            THEN procurement_anomaly_findings.status

                            ELSE 'OPEN'
                        END,

                    disposed_by_user_id =
                        CASE
                            WHEN procurement_anomaly_findings.status
                                IN (
                                    'CONFIRMED',
                                    'DISMISSED'
                                )
                            THEN procurement_anomaly_findings.disposed_by_user_id

                            ELSE NULL
                        END,

                    disposition_note =
                        CASE
                            WHEN procurement_anomaly_findings.status
                                IN (
                                    'CONFIRMED',
                                    'DISMISSED'
                                )
                            THEN procurement_anomaly_findings.disposition_note

                            ELSE NULL
                        END,

                    disposed_at =
                        CASE
                            WHEN procurement_anomaly_findings.status
                                IN (
                                    'CONFIRMED',
                                    'DISMISSED'
                                )
                            THEN procurement_anomaly_findings.disposed_at

                            ELSE NULL
                        END,

                    last_seen_at =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        procurement_anomaly_findings.version
                        + 1
                """,
                findingId,
                candidate.findingKey(),
                ruleId,
                candidate.entityType(),
                candidate.entityId(),
                candidate.relatedEntityId(),
                candidate.entityReference(),
                candidate.currency(),
                candidate.exposureValue(),
                candidate.metricValue(),
                anomalyScore,
                candidate.details()
        );
    }

    public int autoResolveFinding(
            UUID findingId
    ) {
        return jdbcTemplate.update(
                """
                UPDATE procurement_anomaly_findings
                SET
                    status =
                        'RESOLVED',
                    disposed_by_user_id =
                        NULL,
                    disposition_note =
                        'Automatically resolved because the latest anomaly scan no longer detects this signal.',
                    disposed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'OPEN',
                    'UNDER_INVESTIGATION'
                )
                """,
                findingId
        );
    }

    public int autoResolveDisabledRuleFindings() {
        return jdbcTemplate.update(
                """
                UPDATE procurement_anomaly_findings finding
                SET
                    status =
                        'RESOLVED',
                    disposed_by_user_id =
                        NULL,
                    disposition_note =
                        'Automatically resolved because the anomaly rule is disabled.',
                    disposed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        finding.version + 1

                FROM procurement_anomaly_rules rule

                WHERE finding.rule_id =
                    rule.id

                AND rule.enabled =
                    FALSE

                AND finding.status IN (
                    'OPEN',
                    'UNDER_INVESTIGATION'
                )
                """
        );
    }

    public void cancelActiveInvestigationsForFinding(
            UUID findingId,
            String conclusion
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_investigation_cases
                SET
                    status =
                        'CANCELLED',
                    conclusion = ?,
                    closed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE finding_id = ?
                AND status IN (
                    'OPEN',
                    'IN_PROGRESS'
                )
                """,
                conclusion,
                findingId
        );
    }

    public void createInvestigation(
            UUID investigationId,
            String caseNumber,
            UUID findingId,
            UUID ownerUserId,
            InvestigationCreateInput input
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investigation_cases (
                    id,
                    case_number,
                    finding_id,
                    owner_user_id,
                    priority,
                    status,
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
                    'OPEN',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                investigationId,
                caseNumber,
                findingId,
                ownerUserId,
                input.priority()
                        .name(),
                input.dueDate()
        );

        jdbcTemplate.update(
                """
                UPDATE procurement_anomaly_findings
                SET
                    status =
                        'UNDER_INVESTIGATION',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'OPEN'
                """,
                findingId
        );
    }

    public InvestigationRow findInvestigation(
            UUID investigationId
    ) {
        return jdbcTemplate.query(
                investigationSql()
                        + """
                        WHERE investigation.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapInvestigation(
                                resultSet
                        ),
                investigationId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<InvestigationRow> investigationsForFinding(
            UUID findingId
    ) {
        return jdbcTemplate.query(
                investigationSql()
                        + """
                        WHERE investigation.finding_id = ?

                        ORDER BY
                            investigation.created_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapInvestigation(
                                resultSet
                        ),
                findingId
        );
    }

    public void startInvestigation(
            UUID investigationId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_investigation_cases
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
                investigationId
        );
    }

    public void addEvidence(
            UUID investigationId,
            InvestigationEvidenceInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_investigation_evidence (
                    id,
                    investigation_id,
                    evidence_type,
                    reference_text,
                    added_by_user_id,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                investigationId,
                input.evidenceType()
                        .name(),
                input.referenceText()
                        .trim(),
                currentUserId
        );
    }

    public List<EvidenceRow> evidenceForInvestigation(
            UUID investigationId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    evidence.id,
                    evidence.investigation_id,
                    evidence.evidence_type,
                    evidence.reference_text,
                    evidence.added_by_user_id,

                    user_account.full_name
                        AS added_by_name,

                    evidence.created_at

                FROM procurement_investigation_evidence
                    evidence

                JOIN app_users user_account
                    ON user_account.id =
                       evidence.added_by_user_id

                WHERE evidence.investigation_id = ?

                ORDER BY
                    evidence.created_at DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new EvidenceRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "investigation_id",
                                        UUID.class
                                ),
                                InvestigationEvidenceType.valueOf(
                                        resultSet.getString(
                                                "evidence_type"
                                        )
                                ),
                                resultSet.getString(
                                        "reference_text"
                                ),
                                resultSet.getObject(
                                        "added_by_user_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "added_by_name"
                                ),
                                resultSet.getTimestamp(
                                        "created_at"
                                )
                                        .toInstant()
                        ),
                investigationId
        );
    }

    public void closeInvestigation(
            UUID investigationId,
            String conclusion
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_investigation_cases
                SET
                    status =
                        'CLOSED',
                    conclusion = ?,
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
                conclusion,
                investigationId
        );
    }

    public void cancelInvestigation(
            UUID investigationId,
            String conclusion
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_investigation_cases
                SET
                    status =
                        'CANCELLED',
                    conclusion = ?,
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
                conclusion,
                investigationId
        );
    }

    public void reopenFindingAfterCancelledInvestigation(
            UUID findingId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_anomaly_findings
                SET
                    status =
                        'OPEN',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'UNDER_INVESTIGATION'
                AND NOT EXISTS (
                    SELECT 1
                    FROM procurement_investigation_cases
                        investigation
                    WHERE
                        investigation.finding_id =
                            procurement_anomaly_findings.id
                    AND investigation.status IN (
                        'OPEN',
                        'IN_PROGRESS'
                    )
                )
                """,
                findingId
        );
    }

    public void disposeFinding(
            UUID findingId,
            InvestigationDisposition disposition,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_anomaly_findings
                SET
                    status = ?,
                    disposed_by_user_id = ?,
                    disposition_note = ?,
                    disposed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                disposition.name(),
                currentUserId,
                note.trim(),
                findingId
        );
    }

    public InvestigationStats investigationStats() {
        return jdbcTemplate.query(
                """
                SELECT
                    COUNT(*)
                    FILTER (
                        WHERE status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                    )
                        AS active_cases,

                    COUNT(*)
                    FILTER (
                        WHERE status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                        AND due_date
                            < CURRENT_DATE
                    )
                        AS overdue_cases

                FROM procurement_investigation_cases
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new InvestigationStats(
                                resultSet.getLong(
                                        "active_cases"
                                ),
                                resultSet.getLong(
                                        "overdue_cases"
                                )
                        )
        )
                .stream()
                .findFirst()
                .orElse(
                        new InvestigationStats(
                                0,
                                0
                        )
                );
    }

    public Instant lastScanAt() {
        Timestamp timestamp =
                jdbcTemplate.queryForObject(
                        """
                        SELECT MAX(
                            last_seen_at
                        )
                        FROM procurement_anomaly_findings
                        """,
                        Timestamp.class
                );

        return timestamp == null
                ? null
                : timestamp.toInstant();
    }

    public List<AnomalyUserOptionResponse> users() {
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
                        new AnomalyUserOptionResponse(
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

    private String findingSql() {
        return """
                SELECT
                    finding.id,
                    finding.finding_key,

                    finding.rule_id,
                    rule.rule_code,
                    rule.signal_type,
                    rule.title
                        AS rule_title,
                    rule.default_severity,

                    finding.entity_type,
                    finding.entity_id,
                    finding.related_entity_id,
                    finding.entity_reference,
                    finding.currency,
                    finding.exposure_value,
                    finding.metric_value,
                    finding.anomaly_score,
                    finding.details,
                    finding.status,

                    (
                        SELECT COUNT(*)
                        FROM procurement_investigation_cases
                            investigation
                        WHERE
                            investigation.finding_id =
                                finding.id
                        AND investigation.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                    )
                        AS active_investigations,

                    (
                        SELECT COUNT(*)
                        FROM procurement_investigation_cases
                            investigation
                        WHERE
                            investigation.finding_id =
                                finding.id
                        AND investigation.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                        AND investigation.due_date
                            < CURRENT_DATE
                    )
                        AS overdue_investigations,

                    finding.detected_at,
                    finding.last_seen_at,
                    finding.disposition_note,
                    finding.disposed_at,

                    disposer.full_name
                        AS disposed_by_name,

                    finding.created_at,
                    finding.updated_at,
                    finding.version

                FROM procurement_anomaly_findings finding

                JOIN procurement_anomaly_rules rule
                    ON rule.id =
                       finding.rule_id

                LEFT JOIN app_users disposer
                    ON disposer.id =
                       finding.disposed_by_user_id

                """;
    }

    private String investigationSql() {
        return """
                SELECT
                    investigation.id,
                    investigation.case_number,
                    investigation.finding_id,
                    investigation.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    investigation.priority,
                    investigation.status,
                    investigation.due_date,
                    investigation.conclusion,
                    investigation.closed_at,
                    investigation.created_at,
                    investigation.updated_at,
                    investigation.version

                FROM procurement_investigation_cases
                    investigation

                JOIN app_users owner
                    ON owner.id =
                       investigation.owner_user_id

                """;
    }

    private FindingRow mapFinding(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp disposed =
                resultSet.getTimestamp(
                        "disposed_at"
                );

        return new FindingRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "finding_key"
                ),
                resultSet.getLong(
                        "rule_id"
                ),
                resultSet.getString(
                        "rule_code"
                ),
                AnomalySignalType.valueOf(
                        resultSet.getString(
                                "signal_type"
                        )
                ),
                resultSet.getString(
                        "rule_title"
                ),
                AnomalySeverity.valueOf(
                        resultSet.getString(
                                "default_severity"
                        )
                ),
                resultSet.getString(
                        "entity_type"
                ),
                resultSet.getObject(
                        "entity_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "related_entity_id",
                        UUID.class
                ),
                resultSet.getString(
                        "entity_reference"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getBigDecimal(
                        "exposure_value"
                ),
                resultSet.getBigDecimal(
                        "metric_value"
                ),
                resultSet.getBigDecimal(
                        "anomaly_score"
                ),
                resultSet.getString(
                        "details"
                ),
                AnomalyFindingStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getLong(
                        "active_investigations"
                ),
                resultSet.getLong(
                        "overdue_investigations"
                ),
                resultSet.getTimestamp(
                        "detected_at"
                )
                        .toInstant(),
                resultSet.getTimestamp(
                        "last_seen_at"
                )
                        .toInstant(),
                resultSet.getString(
                        "disposition_note"
                ),
                disposed == null
                        ? null
                        : disposed.toInstant(),
                resultSet.getString(
                        "disposed_by_name"
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

    private InvestigationRow mapInvestigation(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp closed =
                resultSet.getTimestamp(
                        "closed_at"
                );

        return new InvestigationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "case_number"
                ),
                resultSet.getObject(
                        "finding_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                InvestigationPriority.valueOf(
                        resultSet.getString(
                                "priority"
                        )
                ),
                InvestigationStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                resultSet.getString(
                        "conclusion"
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

    public record RuleRow(
            long id,
            String ruleCode,
            AnomalySignalType signalType,
            String title,
            String description,
            AnomalySeverity defaultSeverity,
            BigDecimal scoreWeight,
            BigDecimal thresholdValue,
            int lookbackDays,
            boolean enabled,
            long activeFindings
    ) {
    }

    public record AnomalyCandidate(
            String findingKey,
            String entityType,
            UUID entityId,
            UUID relatedEntityId,
            String entityReference,
            String currency,
            BigDecimal exposureValue,
            BigDecimal metricValue,
            String details
    ) {
    }

    public record FindingRow(
            UUID id,
            String findingKey,
            long ruleId,
            String ruleCode,
            AnomalySignalType signalType,
            String ruleTitle,
            AnomalySeverity severity,
            String entityType,
            UUID entityId,
            UUID relatedEntityId,
            String entityReference,
            String currency,
            BigDecimal exposureValue,
            BigDecimal metricValue,
            BigDecimal anomalyScore,
            String details,
            AnomalyFindingStatus status,
            long activeInvestigations,
            long overdueInvestigations,
            Instant detectedAt,
            Instant lastSeenAt,
            String dispositionNote,
            Instant disposedAt,
            String disposedByName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record InvestigationRow(
            UUID id,
            String caseNumber,
            UUID findingId,
            UUID ownerUserId,
            String ownerName,
            InvestigationPriority priority,
            InvestigationStatus status,
            LocalDate dueDate,
            String conclusion,
            Instant closedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record EvidenceRow(
            UUID id,
            UUID investigationId,
            InvestigationEvidenceType evidenceType,
            String referenceText,
            UUID addedByUserId,
            String addedByName,
            Instant createdAt
    ) {
    }

    public record InvestigationStats(
            long activeCases,
            long overdueCases
    ) {
    }
}
