package com.procureiq.dataquality;

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
public class DataQualityRepository {

    private final JdbcTemplate jdbcTemplate;

    public DataQualityRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public List<RuleRow> rules() {
        return jdbcTemplate.query(
                """
                SELECT
                    rule.id,
                    rule.rule_code,
                    rule.domain,
                    rule.title,
                    rule.description,
                    rule.severity,
                    rule.weight,
                    rule.enabled,

                    (
                        SELECT COUNT(*)
                        FROM data_quality_findings
                            finding
                        WHERE
                            finding.rule_id =
                                rule.id
                        AND finding.status IN (
                            'OPEN',
                            'REMEDIATION_IN_PROGRESS'
                        )
                    )
                        AS active_findings

                FROM data_quality_rules rule

                ORDER BY
                    rule.domain,
                    CASE rule.severity
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
                                DataQualityDomain.valueOf(
                                        resultSet.getString(
                                                "domain"
                                        )
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "description"
                                ),
                                DataQualitySeverity.valueOf(
                                        resultSet.getString(
                                                "severity"
                                        )
                                ),
                                resultSet.getBigDecimal(
                                        "weight"
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
            DataQualityRuleUpdateInput input
    ) {
        jdbcTemplate.update(
                """
                UPDATE data_quality_rules
                SET
                    enabled = ?,
                    severity = ?,
                    weight = ?,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                input.enabled(),
                input.severity()
                        .name(),
                input.weight(),
                ruleId
        );
    }

    public List<FindingCandidate> candidatesForRule(
            String ruleCode
    ) {
        return switch (
                ruleCode
        ) {
            case "SUPPLIER_DUPLICATE_NAME" ->
                    duplicateSupplierCandidates();

            case "SUPPLIER_CATEGORY_MISSING" ->
                    supplierCategoryMissing();

            case "SUPPLIER_COUNTRY_MISSING" ->
                    supplierCountryMissing();

            case "SUPPLIER_RATING_MISSING" ->
                    supplierRatingMissing();

            case "SUPPLIER_RISK_MISSING" ->
                    supplierRiskMissing();

            case "SUPPLIER_NAME_WHITESPACE" ->
                    supplierNameWhitespace();

            case "SUPPLIER_CODE_WHITESPACE" ->
                    supplierCodeWhitespace();

            case "INACTIVE_SUPPLIER_OPEN_PO" ->
                    inactiveSupplierOpenPurchaseOrder();

            case "INVOICE_SUPPLIER_MISMATCH" ->
                    invoiceSupplierMismatch();

            case "INVOICE_CURRENCY_MISMATCH" ->
                    invoiceCurrencyMismatch();

            case "PROCESS_REFERENCE_MISSING" ->
                    processReferenceMissing();

            default ->
                    List.of();
        };
    }

    private List<FindingCandidate> duplicateSupplierCandidates() {
        return jdbcTemplate.query(
                """
                SELECT
                    supplier_one.id
                        AS entity_id,

                    supplier_two.id
                        AS related_entity_id,

                    supplier_one.supplier_code
                        AS supplier_one_code,

                    supplier_two.supplier_code
                        AS supplier_two_code,

                    supplier_one.legal_name,

                    supplier_one.country

                FROM suppliers supplier_one

                JOIN suppliers supplier_two
                    ON supplier_one.id::TEXT
                       <
                       supplier_two.id::TEXT

                WHERE supplier_one.status =
                    'ACTIVE'

                AND supplier_two.status =
                    'ACTIVE'

                AND REGEXP_REPLACE(
                    LOWER(
                        BTRIM(
                            supplier_one.legal_name
                        )
                    ),
                    '[^a-z0-9]+',
                    '',
                    'g'
                )
                =
                REGEXP_REPLACE(
                    LOWER(
                        BTRIM(
                            supplier_two.legal_name
                        )
                    ),
                    '[^a-z0-9]+',
                    '',
                    'g'
                )

                AND COALESCE(
                    NULLIF(
                        LOWER(
                            BTRIM(
                                supplier_one.country
                            )
                        ),
                        ''
                    ),
                    '<missing>'
                )
                =
                COALESCE(
                    NULLIF(
                        LOWER(
                            BTRIM(
                                supplier_two.country
                            )
                        ),
                        ''
                    ),
                    '<missing>'
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID first =
                            resultSet.getObject(
                                    "entity_id",
                                    UUID.class
                            );

                    UUID second =
                            resultSet.getObject(
                                    "related_entity_id",
                                    UUID.class
                            );

                    return new FindingCandidate(
                            "SUPPLIER_DUPLICATE_NAME:"
                                    + first
                                    + ":"
                                    + second,
                            "SUPPLIER",
                            first,
                            second,
                            resultSet.getString(
                                    "supplier_one_code"
                            )
                                    + " / "
                                    + resultSet.getString(
                                            "supplier_two_code"
                                    ),
                            "Potential duplicate suppliers share normalized legal name '"
                                    + resultSet.getString(
                                            "legal_name"
                                    )
                                    + "' and country '"
                                    + java.util.Objects.toString(
                                            resultSet.getString(
                                                    "country"
                                            ),
                                            "Missing"
                                    )
                                    + "'."
                    );
                }
        );
    }

    private List<FindingCandidate> supplierCategoryMissing() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name
                FROM suppliers
                WHERE status =
                    'ACTIVE'
                AND (
                    category IS NULL
                    OR BTRIM(category) = ''
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        supplierCandidate(
                                "SUPPLIER_CATEGORY_MISSING",
                                resultSet,
                                "Active supplier has no procurement category."
                        )
        );
    }

    private List<FindingCandidate> supplierCountryMissing() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name
                FROM suppliers
                WHERE status =
                    'ACTIVE'
                AND (
                    country IS NULL
                    OR BTRIM(country) = ''
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        supplierCandidate(
                                "SUPPLIER_COUNTRY_MISSING",
                                resultSet,
                                "Active supplier has no country value."
                        )
        );
    }

    private List<FindingCandidate> supplierRatingMissing() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name
                FROM suppliers
                WHERE status =
                    'ACTIVE'
                AND rating IS NULL
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        supplierCandidate(
                                "SUPPLIER_RATING_MISSING",
                                resultSet,
                                "Active supplier has no supplier rating."
                        )
        );
    }

    private List<FindingCandidate> supplierRiskMissing() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name
                FROM suppliers
                WHERE status =
                    'ACTIVE'
                AND (
                    risk_level IS NULL
                    OR BTRIM(risk_level) = ''
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        supplierCandidate(
                                "SUPPLIER_RISK_MISSING",
                                resultSet,
                                "Active supplier has no risk classification."
                        )
        );
    }

    private List<FindingCandidate> supplierNameWhitespace() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name
                FROM suppliers
                WHERE status =
                    'ACTIVE'
                AND legal_name
                    <> BTRIM(legal_name)
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        supplierCandidate(
                                "SUPPLIER_NAME_WHITESPACE",
                                resultSet,
                                "Supplier legal name contains leading or trailing whitespace."
                        )
        );
    }

    private List<FindingCandidate> supplierCodeWhitespace() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name
                FROM suppliers
                WHERE status =
                    'ACTIVE'
                AND supplier_code
                    <> BTRIM(supplier_code)
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        supplierCandidate(
                                "SUPPLIER_CODE_WHITESPACE",
                                resultSet,
                                "Supplier code contains leading or trailing whitespace."
                        )
        );
    }

    private FindingCandidate supplierCandidate(
            String ruleCode,
            java.sql.ResultSet resultSet,
            String details
    ) throws java.sql.SQLException {
        UUID supplierId =
                resultSet.getObject(
                        "id",
                        UUID.class
                );

        return new FindingCandidate(
                ruleCode
                        + ":"
                        + supplierId,
                "SUPPLIER",
                supplierId,
                null,
                resultSet.getString(
                        "supplier_code"
                )
                        + " — "
                        + resultSet.getString(
                                "legal_name"
                        ),
                details
        );
    }

    private List<FindingCandidate> inactiveSupplierOpenPurchaseOrder() {
        return jdbcTemplate.query(
                """
                SELECT
                    supplier.id
                        AS supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name,

                    purchase_order.id
                        AS purchase_order_id,

                    purchase_order.po_number,
                    purchase_order.status
                        AS purchase_order_status

                FROM purchase_orders
                    purchase_order

                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id

                WHERE COALESCE(
                    supplier.status,
                    ''
                )
                    <> 'ACTIVE'

                AND purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED'
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

                    UUID poId =
                            resultSet.getObject(
                                    "purchase_order_id",
                                    UUID.class
                            );

                    return new FindingCandidate(
                            "INACTIVE_SUPPLIER_OPEN_PO:"
                                    + supplierId
                                    + ":"
                                    + poId,
                            "SUPPLIER",
                            supplierId,
                            poId,
                            resultSet.getString(
                                    "supplier_code"
                            )
                                    + " / "
                                    + resultSet.getString(
                                            "po_number"
                                    ),
                            "Supplier "
                                    + resultSet.getString(
                                            "legal_name"
                                    )
                                    + " is not active but purchase order "
                                    + resultSet.getString(
                                            "po_number"
                                    )
                                    + " remains "
                                    + resultSet.getString(
                                            "purchase_order_status"
                                    )
                                    + "."
                    );
                }
        );
    }

    private List<FindingCandidate> invoiceSupplierMismatch() {
        return jdbcTemplate.query(
                """
                SELECT
                    invoice.id
                        AS invoice_id,

                    invoice.invoice_number,

                    invoice.supplier_id
                        AS invoice_supplier_id,

                    purchase_order.id
                        AS purchase_order_id,

                    purchase_order.po_number,

                    purchase_order.supplier_id
                        AS po_supplier_id

                FROM procurement_invoices invoice

                JOIN purchase_orders
                    purchase_order
                    ON purchase_order.id =
                       invoice.purchase_order_id

                WHERE invoice.supplier_id
                    <>
                    purchase_order.supplier_id
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID invoiceId =
                            resultSet.getObject(
                                    "invoice_id",
                                    UUID.class
                            );

                    UUID poId =
                            resultSet.getObject(
                                    "purchase_order_id",
                                    UUID.class
                            );

                    return new FindingCandidate(
                            "INVOICE_SUPPLIER_MISMATCH:"
                                    + invoiceId,
                            "INVOICE",
                            invoiceId,
                            poId,
                            resultSet.getString(
                                    "invoice_number"
                            )
                                    + " / "
                                    + resultSet.getString(
                                            "po_number"
                                    ),
                            "Invoice supplier "
                                    + resultSet.getObject(
                                            "invoice_supplier_id",
                                            UUID.class
                                    )
                                    + " differs from purchase-order supplier "
                                    + resultSet.getObject(
                                            "po_supplier_id",
                                            UUID.class
                                    )
                                    + "."
                    );
                }
        );
    }

    private List<FindingCandidate> invoiceCurrencyMismatch() {
        return jdbcTemplate.query(
                """
                SELECT
                    invoice.id
                        AS invoice_id,

                    invoice.invoice_number,
                    invoice.currency
                        AS invoice_currency,

                    purchase_order.id
                        AS purchase_order_id,

                    purchase_order.po_number,
                    purchase_order.currency
                        AS po_currency

                FROM procurement_invoices invoice

                JOIN purchase_orders
                    purchase_order
                    ON purchase_order.id =
                       invoice.purchase_order_id

                WHERE UPPER(
                    invoice.currency
                )
                    <>
                    UPPER(
                        purchase_order.currency
                    )
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID invoiceId =
                            resultSet.getObject(
                                    "invoice_id",
                                    UUID.class
                            );

                    UUID poId =
                            resultSet.getObject(
                                    "purchase_order_id",
                                    UUID.class
                            );

                    return new FindingCandidate(
                            "INVOICE_CURRENCY_MISMATCH:"
                                    + invoiceId,
                            "INVOICE",
                            invoiceId,
                            poId,
                            resultSet.getString(
                                    "invoice_number"
                            )
                                    + " / "
                                    + resultSet.getString(
                                            "po_number"
                                    ),
                            "Invoice currency "
                                    + resultSet.getString(
                                            "invoice_currency"
                                    )
                                    + " differs from purchase-order currency "
                                    + resultSet.getString(
                                            "po_currency"
                                    )
                                    + "."
                    );
                }
        );
    }

    private List<FindingCandidate> processReferenceMissing() {
        return jdbcTemplate.query(
                """
                WITH latest AS (
                    SELECT DISTINCT ON (
                        entity_type,
                        entity_id
                    )
                        entity_type,
                        entity_id,
                        entity_reference,
                        source_table

                    FROM procurement_process_events

                    ORDER BY
                        entity_type,
                        entity_id,
                        event_at DESC,
                        id DESC
                )

                SELECT
                    entity_type,
                    entity_id,
                    source_table

                FROM latest

                WHERE entity_reference IS NULL
                OR BTRIM(entity_reference) = ''
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

                    return new FindingCandidate(
                            "PROCESS_REFERENCE_MISSING:"
                                    + resultSet.getString(
                                            "entity_type"
                                    )
                                    + ":"
                                    + entityId,
                            "PROCESS_ENTITY",
                            entityId,
                            null,
                            resultSet.getString(
                                    "entity_type"
                            )
                                    + " / "
                                    + entityId,
                            "Latest "
                                    + resultSet.getString(
                                            "entity_type"
                                    )
                                    + " process event from "
                                    + resultSet.getString(
                                            "source_table"
                                    )
                                    + " has no usable entity reference."
                    );
                }
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

    public List<FindingRow> findings() {
        return jdbcTemplate.query(
                findingSql()
                        + """
                        ORDER BY
                            CASE finding.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'REMEDIATION_IN_PROGRESS'
                                THEN 2
                                WHEN 'RESOLVED'
                                THEN 3
                                ELSE 4
                            END,

                            CASE rule.severity
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                WHEN 'MEDIUM'
                                THEN 3
                                ELSE 4
                            END,

                            finding.last_seen_at DESC

                        LIMIT 500
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapFinding(
                                resultSet
                        )
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
                            'REMEDIATION_IN_PROGRESS'
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
            FindingCandidate candidate
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO data_quality_findings (
                    id,
                    finding_key,
                    rule_id,
                    entity_type,
                    entity_id,
                    related_entity_id,
                    entity_reference,
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
                    details =
                        EXCLUDED.details,

                    status =
                        CASE
                            WHEN data_quality_findings.status
                                IN (
                                    'REMEDIATION_IN_PROGRESS',
                                    'DISMISSED'
                                )
                            THEN data_quality_findings.status

                            ELSE 'OPEN'
                        END,

                    last_seen_at =
                        CURRENT_TIMESTAMP,

                    resolved_by_user_id =
                        CASE
                            WHEN data_quality_findings.status =
                                'DISMISSED'
                            THEN data_quality_findings.resolved_by_user_id

                            ELSE NULL
                        END,

                    resolution_note =
                        CASE
                            WHEN data_quality_findings.status =
                                'DISMISSED'
                            THEN data_quality_findings.resolution_note

                            ELSE NULL
                        END,

                    resolved_at =
                        CASE
                            WHEN data_quality_findings.status =
                                'DISMISSED'
                            THEN data_quality_findings.resolved_at

                            ELSE NULL
                        END,

                    updated_at =
                        CURRENT_TIMESTAMP,

                    version =
                        data_quality_findings.version
                        + 1
                """,
                findingId,
                candidate.findingKey(),
                ruleId,
                candidate.entityType(),
                candidate.entityId(),
                candidate.relatedEntityId(),
                candidate.entityReference(),
                candidate.details()
        );
    }

    public int autoResolveFinding(
            UUID findingId,
            String note
    ) {
        return jdbcTemplate.update(
                """
                UPDATE data_quality_findings
                SET
                    status =
                        'RESOLVED',
                    resolved_by_user_id =
                        NULL,
                    resolution_note = ?,
                    resolved_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'OPEN',
                    'REMEDIATION_IN_PROGRESS'
                )
                """,
                note,
                findingId
        );
    }

    public int autoResolveDisabledRuleFindings() {
        return jdbcTemplate.update(
                """
                UPDATE data_quality_findings finding
                SET
                    status =
                        'RESOLVED',
                    resolved_by_user_id =
                        NULL,
                    resolution_note =
                        'Automatically resolved because the data-quality rule is disabled.',
                    resolved_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        finding.version + 1

                FROM data_quality_rules rule

                WHERE finding.rule_id =
                    rule.id

                AND rule.enabled =
                    FALSE

                AND finding.status IN (
                    'OPEN',
                    'REMEDIATION_IN_PROGRESS'
                )
                """
        );
    }

    public void decideFinding(
            UUID findingId,
            UUID currentUserId,
            String note,
            DataQualityFindingStatus status
    ) {
        jdbcTemplate.update(
                """
                UPDATE data_quality_findings
                SET
                    status = ?,
                    resolved_by_user_id = ?,
                    resolution_note = ?,
                    resolved_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'OPEN',
                    'REMEDIATION_IN_PROGRESS'
                )
                """,
                status.name(),
                currentUserId,
                note.trim(),
                findingId
        );
    }

    public void cancelActiveRemediationTasks(
            UUID findingId
    ) {
        jdbcTemplate.update(
                """
                UPDATE data_quality_remediation_tasks
                SET
                    status =
                        'CANCELLED',
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
                findingId
        );
    }

    public void createRemediation(
            UUID taskId,
            UUID findingId,
            DataQualityRemediationInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO data_quality_remediation_tasks (
                    id,
                    finding_id,
                    title,
                    owner_user_id,
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
                    'OPEN',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                taskId,
                findingId,
                input.title()
                        .trim(),
                ownerUserId,
                input.dueDate()
        );

        jdbcTemplate.update(
                """
                UPDATE data_quality_findings
                SET
                    status =
                        'REMEDIATION_IN_PROGRESS',
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

    public RemediationRow findRemediation(
            UUID taskId
    ) {
        return jdbcTemplate.query(
                remediationSql()
                        + """
                        WHERE task.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRemediation(
                                resultSet
                        ),
                taskId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<RemediationRow> remediationsForFinding(
            UUID findingId
    ) {
        return jdbcTemplate.query(
                remediationSql()
                        + """
                        WHERE task.finding_id = ?
                        ORDER BY
                            CASE task.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'IN_PROGRESS'
                                THEN 2
                                WHEN 'COMPLETED'
                                THEN 3
                                ELSE 4
                            END,
                            task.due_date
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRemediation(
                                resultSet
                        ),
                findingId
        );
    }

    public void startRemediation(
            UUID taskId
    ) {
        jdbcTemplate.update(
                """
                UPDATE data_quality_remediation_tasks
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
                taskId
        );
    }

    public void completeRemediation(
            UUID taskId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE data_quality_remediation_tasks
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
                taskId
        );
    }

    public void cancelRemediation(
            UUID taskId
    ) {
        jdbcTemplate.update(
                """
                UPDATE data_quality_remediation_tasks
                SET
                    status =
                        'CANCELLED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status
                    <> 'COMPLETED'
                """,
                taskId
        );
    }

    public void reopenFindingWhenNoActiveTask(
            UUID findingId
    ) {
        jdbcTemplate.update(
                """
                UPDATE data_quality_findings
                SET
                    status =
                        'OPEN',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'REMEDIATION_IN_PROGRESS'
                AND NOT EXISTS (
                    SELECT 1
                    FROM data_quality_remediation_tasks
                        task
                    WHERE
                        task.finding_id =
                            data_quality_findings.id
                    AND task.status IN (
                        'OPEN',
                        'IN_PROGRESS'
                    )
                )
                """,
                findingId
        );
    }

    public RemediationStats remediationStats() {
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
                        AS active_tasks,

                    COUNT(*)
                    FILTER (
                        WHERE status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                        AND due_date
                            < CURRENT_DATE
                    )
                        AS overdue_tasks

                FROM data_quality_remediation_tasks
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new RemediationStats(
                                resultSet.getLong(
                                        "active_tasks"
                                ),
                                resultSet.getLong(
                                        "overdue_tasks"
                                )
                        )
        )
                .stream()
                .findFirst()
                .orElse(
                        new RemediationStats(
                                0,
                                0
                        )
                );
    }

    public Instant lastScanAt() {
        Timestamp value =
                jdbcTemplate.queryForObject(
                        """
                        SELECT MAX(
                            last_seen_at
                        )
                        FROM data_quality_findings
                        """,
                        Timestamp.class
                );

        return value == null
                ? null
                : value.toInstant();
    }

    public List<DataQualityUserOptionResponse> users() {
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
                        new DataQualityUserOptionResponse(
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
                    rule.domain,
                    rule.title
                        AS rule_title,
                    rule.severity,

                    finding.entity_type,
                    finding.entity_id,
                    finding.related_entity_id,
                    finding.entity_reference,
                    finding.details,
                    finding.status,

                    (
                        SELECT COUNT(*)
                        FROM data_quality_remediation_tasks
                            task
                        WHERE
                            task.finding_id =
                                finding.id
                        AND task.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                    )
                        AS open_remediation_tasks,

                    (
                        SELECT COUNT(*)
                        FROM data_quality_remediation_tasks
                            task
                        WHERE
                            task.finding_id =
                                finding.id
                        AND task.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                        AND task.due_date
                            < CURRENT_DATE
                    )
                        AS overdue_remediation_tasks,

                    finding.detected_at,
                    finding.last_seen_at,
                    finding.resolution_note,
                    finding.resolved_at,

                    resolver.full_name
                        AS resolved_by_name,

                    finding.created_at,
                    finding.updated_at,
                    finding.version

                FROM data_quality_findings finding

                JOIN data_quality_rules rule
                    ON rule.id =
                       finding.rule_id

                LEFT JOIN app_users resolver
                    ON resolver.id =
                       finding.resolved_by_user_id

                """;
    }

    private String remediationSql() {
        return """
                SELECT
                    task.id,
                    task.finding_id,
                    task.title,
                    task.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    task.due_date,
                    task.status,
                    task.completion_note,
                    task.completed_at,
                    task.created_at,
                    task.updated_at,
                    task.version

                FROM data_quality_remediation_tasks
                    task

                JOIN app_users owner
                    ON owner.id =
                       task.owner_user_id

                """;
    }

    private FindingRow mapFinding(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp resolved =
                resultSet.getTimestamp(
                        "resolved_at"
                );

        Timestamp detected =
                resultSet.getTimestamp(
                        "detected_at"
                );

        Timestamp lastSeen =
                resultSet.getTimestamp(
                        "last_seen_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
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
                DataQualityDomain.valueOf(
                        resultSet.getString(
                                "domain"
                        )
                ),
                resultSet.getString(
                        "rule_title"
                ),
                DataQualitySeverity.valueOf(
                        resultSet.getString(
                                "severity"
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
                        "details"
                ),
                DataQualityFindingStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getLong(
                        "open_remediation_tasks"
                ),
                resultSet.getLong(
                        "overdue_remediation_tasks"
                ),
                detected.toInstant(),
                lastSeen.toInstant(),
                resultSet.getString(
                        "resolution_note"
                ),
                resolved == null
                        ? null
                        : resolved.toInstant(),
                resultSet.getString(
                        "resolved_by_name"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private RemediationRow mapRemediation(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp completed =
                resultSet.getTimestamp(
                        "completed_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new RemediationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "finding_id",
                        UUID.class
                ),
                resultSet.getString(
                        "title"
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
                DataQualityRemediationStatus.valueOf(
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
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    public record RuleRow(
            long id,
            String ruleCode,
            DataQualityDomain domain,
            String title,
            String description,
            DataQualitySeverity severity,
            BigDecimal weight,
            boolean enabled,
            long activeFindings
    ) {
    }

    public record FindingCandidate(
            String findingKey,
            String entityType,
            UUID entityId,
            UUID relatedEntityId,
            String entityReference,
            String details
    ) {
    }

    public record FindingRow(
            UUID id,
            String findingKey,
            long ruleId,
            String ruleCode,
            DataQualityDomain domain,
            String ruleTitle,
            DataQualitySeverity severity,
            String entityType,
            UUID entityId,
            UUID relatedEntityId,
            String entityReference,
            String details,
            DataQualityFindingStatus status,
            long openRemediationTasks,
            long overdueRemediationTasks,
            Instant detectedAt,
            Instant lastSeenAt,
            String resolutionNote,
            Instant resolvedAt,
            String resolvedByName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record RemediationRow(
            UUID id,
            UUID findingId,
            String title,
            UUID ownerUserId,
            String ownerName,
            LocalDate dueDate,
            DataQualityRemediationStatus status,
            String completionNote,
            Instant completedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record RemediationStats(
            long activeTasks,
            long overdueTasks
    ) {
    }
}
