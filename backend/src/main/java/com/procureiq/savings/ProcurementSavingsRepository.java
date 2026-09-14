package com.procureiq.savings;

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
public class ProcurementSavingsRepository {

    private final JdbcTemplate jdbcTemplate;

    public ProcurementSavingsRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextSavingsSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_savings_number_seq'
                )
                """,
                Long.class
        );
    }

    public void createManualInitiative(
            UUID id,
            String savingsNumber,
            SavingsInitiativeInput input,
            UUID ownerUserId,
            BigDecimal targetSavings,
            String normalizedCurrency
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_savings_initiatives (
                    id,
                    savings_number,
                    source_key,
                    origin,
                    title,
                    savings_type,
                    status,
                    fiscal_year,
                    currency,
                    category,
                    rfq_id,
                    supplier_id,
                    purchase_order_id,
                    baseline_value,
                    negotiated_value,
                    target_savings,
                    realized_savings,
                    owner_user_id,
                    notes,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    NULL,
                    'MANUAL',
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
                    0,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                savingsNumber,
                input.title().trim(),
                input.savingsType().name(),
                input.fiscalYear(),
                normalizedCurrency,
                normalizeOptional(
                        input.category()
                ),
                input.rfqId(),
                input.supplierId(),
                input.purchaseOrderId(),
                input.baselineValue(),
                input.negotiatedValue(),
                targetSavings,
                ownerUserId,
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public void createSystemInitiative(
            UUID id,
            String savingsNumber,
            OpportunityRow opportunity,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_savings_initiatives (
                    id,
                    savings_number,
                    source_key,
                    origin,
                    title,
                    savings_type,
                    status,
                    fiscal_year,
                    currency,
                    category,
                    rfq_id,
                    supplier_id,
                    purchase_order_id,
                    baseline_value,
                    negotiated_value,
                    target_savings,
                    realized_savings,
                    owner_user_id,
                    notes,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    'SYSTEM',
                    ?,
                    'HARD_SAVINGS',
                    'SUBMITTED',
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    0,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                savingsNumber,
                opportunity.sourceKey(),
                "Sourcing savings — "
                        + opportunity.rfqNumber(),
                opportunity.fiscalYear(),
                opportunity.currency(),
                opportunity.category(),
                opportunity.rfqId(),
                opportunity.supplierId(),
                opportunity.purchaseOrderId(),
                opportunity.baselineValue(),
                opportunity.negotiatedValue(),
                opportunity.targetSavings(),
                ownerUserId,
                "Automatically discovered from awarded RFQ "
                        + opportunity.rfqNumber()
        );
    }

    public void updateSystemInitiative(
            UUID initiativeId,
            OpportunityRow opportunity
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_savings_initiatives
                SET
                    category = ?,
                    rfq_id = ?,
                    supplier_id = ?,
                    purchase_order_id = ?,
                    baseline_value = ?,
                    negotiated_value = ?,
                    target_savings = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status
                    <> 'REJECTED'
                """,
                opportunity.category(),
                opportunity.rfqId(),
                opportunity.supplierId(),
                opportunity.purchaseOrderId(),
                opportunity.baselineValue(),
                opportunity.negotiatedValue(),
                opportunity.targetSavings(),
                initiativeId
        );
    }

    public void updateStatus(
            UUID initiativeId,
            SavingsStatus status
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_savings_initiatives
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

    public void recordDecision(
            UUID initiativeId,
            SavingsStatus status,
            UUID decidedByUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_savings_initiatives
                SET
                    status = ?,
                    decided_by_user_id = ?,
                    decision_note = ?,
                    decision_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                status.name(),
                decidedByUserId,
                note.trim(),
                initiativeId
        );
    }

    public InitiativeRow findById(
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

    public InitiativeRow findBySourceKey(
            String sourceKey
    ) {
        return jdbcTemplate.query(
                initiativeSql()
                        + """
                        WHERE initiative.source_key = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapInitiative(
                                resultSet
                        ),
                sourceKey
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<InitiativeRow> findAll(
            int fiscalYear,
            String currency
    ) {
        return jdbcTemplate.query(
                initiativeSql()
                        + """
                        WHERE initiative.fiscal_year = ?
                        AND initiative.currency = ?
                        ORDER BY
                            initiative.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapInitiative(
                                resultSet
                        ),
                fiscalYear,
                currency
        );
    }

    public void createManualRealization(
            UUID id,
            UUID initiativeId,
            SavingsRealizationInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_savings_realizations (
                    id,
                    initiative_id,
                    source_key,
                    source_type,
                    purchase_order_id,
                    realization_date,
                    amount,
                    notes,
                    created_by_user_id,
                    created_at,
                    updated_at
                )
                VALUES (
                    ?,
                    ?,
                    NULL,
                    'MANUAL',
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """,
                id,
                initiativeId,
                input.purchaseOrderId(),
                input.realizationDate(),
                input.amount(),
                normalizeOptional(
                        input.notes()
                ),
                currentUserId
        );
    }

    public boolean upsertPurchaseOrderRealization(
            UUID initiativeId,
            UUID purchaseOrderId,
            LocalDate realizationDate,
            BigDecimal amount,
            UUID currentUserId
    ) {
        String sourceKey =
                "PO:"
                        + purchaseOrderId;

        Integer existingCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM procurement_savings_realizations
                        WHERE source_key = ?
                        """,
                        Integer.class,
                        sourceKey
                );

        if (
                existingCount != null
                &&
                existingCount > 0
        ) {
            jdbcTemplate.update(
                    """
                    UPDATE procurement_savings_realizations
                    SET
                        initiative_id = ?,
                        purchase_order_id = ?,
                        realization_date = ?,
                        amount = ?,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE source_key = ?
                    """,
                    initiativeId,
                    purchaseOrderId,
                    realizationDate,
                    amount,
                    sourceKey
            );

            return false;
        }

        jdbcTemplate.update(
                """
                INSERT INTO procurement_savings_realizations (
                    id,
                    initiative_id,
                    source_key,
                    source_type,
                    purchase_order_id,
                    realization_date,
                    amount,
                    notes,
                    created_by_user_id,
                    created_at,
                    updated_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    'PURCHASE_ORDER',
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                initiativeId,
                sourceKey,
                purchaseOrderId,
                realizationDate,
                amount,
                "Automatically calculated from purchase-order value.",
                currentUserId
        );

        return true;
    }

    public void syncRealizedSavings(
            UUID initiativeId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_savings_initiatives
                SET
                    realized_savings =
                        COALESCE(
                            (
                                SELECT
                                    SUM(
                                        realization.amount
                                    )
                                FROM procurement_savings_realizations
                                    realization
                                WHERE
                                    realization.initiative_id =
                                        procurement_savings_initiatives.id
                            ),
                            0
                        ),
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                initiativeId
        );
    }

    public List<RealizationRow> realizations(
            UUID initiativeId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    realization.id,
                    realization.source_type,
                    realization.purchase_order_id,
                    purchase_order.po_number,
                    realization.realization_date,
                    realization.amount,
                    realization.notes,
                    realization.created_by_user_id,
                    app_user.full_name
                        AS created_by_name,
                    realization.created_at
                FROM procurement_savings_realizations
                    realization
                JOIN app_users app_user
                    ON app_user.id =
                       realization.created_by_user_id
                LEFT JOIN purchase_orders purchase_order
                    ON purchase_order.id =
                       realization.purchase_order_id
                WHERE realization.initiative_id = ?
                ORDER BY
                    realization.realization_date DESC,
                    realization.created_at DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp created =
                            resultSet.getTimestamp(
                                    "created_at"
                            );

                    return new RealizationRow(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            SavingsRealizationSourceType
                                    .valueOf(
                                            resultSet.getString(
                                                    "source_type"
                                            )
                                    ),
                            resultSet.getObject(
                                    "purchase_order_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "po_number"
                            ),
                            resultSet.getObject(
                                    "realization_date",
                                    LocalDate.class
                            ),
                            resultSet.getBigDecimal(
                                    "amount"
                            ),
                            resultSet.getString(
                                    "notes"
                            ),
                            resultSet.getObject(
                                    "created_by_user_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "created_by_name"
                            ),
                            created.toInstant()
                    );
                },
                initiativeId
        );
    }

    public List<OpportunityRow> discoverOpportunities() {
        return jdbcTemplate.query(
                """
                WITH submitted_quote_max AS (
                    SELECT
                        rfq_id,
                        MAX(total_amount)
                            AS baseline_value
                    FROM quotations
                    WHERE status = 'SUBMITTED'
                    GROUP BY rfq_id
                )
                SELECT
                    award.id
                        AS award_id,

                    'AWARD:'
                        || award.id::text
                        AS source_key,

                    EXTRACT(
                        YEAR FROM award.decided_at
                    )::INTEGER
                        AS fiscal_year,

                    rfq.id
                        AS rfq_id,

                    rfq.rfq_number,
                    rfq.currency,

                    supplier.id
                        AS supplier_id,

                    supplier.legal_name
                        AS supplier_name,

                    supplier.category,

                    submitted_quote_max.baseline_value,

                    selected_quotation.total_amount
                        AS negotiated_value,

                    GREATEST(
                        submitted_quote_max.baseline_value
                        - selected_quotation.total_amount,
                        0
                    )
                        AS target_savings,

                    purchase_order.id
                        AS purchase_order_id,

                    purchase_order.po_number,

                    purchase_order.total_amount
                        AS purchase_order_total,

                    COALESCE(
                        purchase_order.issued_at,
                        purchase_order.created_at
                    )
                        AS purchase_order_date

                FROM award_decisions award

                JOIN rfqs rfq
                    ON rfq.id =
                       award.rfq_id

                JOIN quotations selected_quotation
                    ON selected_quotation.id =
                       award.selected_quotation_id

                JOIN suppliers supplier
                    ON supplier.id =
                       selected_quotation.supplier_id

                JOIN submitted_quote_max
                    ON submitted_quote_max.rfq_id =
                       award.rfq_id

                LEFT JOIN purchase_orders purchase_order
                    ON purchase_order.rfq_id =
                       award.rfq_id
                    AND purchase_order.status
                        <> 'CANCELLED'

                WHERE
                    submitted_quote_max.baseline_value
                    >
                    selected_quotation.total_amount

                ORDER BY
                    award.decided_at DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp poDate =
                            resultSet.getTimestamp(
                                    "purchase_order_date"
                            );

                    return new OpportunityRow(
                            resultSet.getObject(
                                    "award_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "source_key"
                            ),
                            resultSet.getInt(
                                    "fiscal_year"
                            ),
                            resultSet.getObject(
                                    "rfq_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "rfq_number"
                            ),
                            resultSet.getString(
                                    "currency"
                            ),
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "supplier_name"
                            ),
                            resultSet.getString(
                                    "category"
                            ),
                            resultSet.getBigDecimal(
                                    "baseline_value"
                            ),
                            resultSet.getBigDecimal(
                                    "negotiated_value"
                            ),
                            resultSet.getBigDecimal(
                                    "target_savings"
                            ),
                            resultSet.getObject(
                                    "purchase_order_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "po_number"
                            ),
                            resultSet.getBigDecimal(
                                    "purchase_order_total"
                            ),
                            poDate == null
                                    ? null
                                    : poDate.toInstant()
                    );
                }
        );
    }

    public List<SavingsMonthlyResponse> monthly(
            int fiscalYear,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    TO_CHAR(
                        DATE_TRUNC(
                            'month',
                            realization.realization_date
                        ),
                        'YYYY-MM'
                    )
                        AS month_key,

                    COALESCE(
                        SUM(
                            realization.amount
                        ),
                        0
                    )
                        AS realized_savings,

                    COUNT(*)
                        AS realization_count

                FROM procurement_savings_realizations
                    realization

                JOIN procurement_savings_initiatives
                    initiative
                    ON initiative.id =
                       realization.initiative_id

                WHERE initiative.fiscal_year = ?
                AND initiative.currency = ?
                AND initiative.status IN (
                    'VALIDATED',
                    'CLOSED'
                )

                GROUP BY
                    DATE_TRUNC(
                        'month',
                        realization.realization_date
                    )

                ORDER BY
                    DATE_TRUNC(
                        'month',
                        realization.realization_date
                    )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SavingsMonthlyResponse(
                                resultSet.getString(
                                        "month_key"
                                ),
                                resultSet.getBigDecimal(
                                        "realized_savings"
                                ),
                                resultSet.getLong(
                                        "realization_count"
                                )
                        ),
                fiscalYear,
                currency
        );
    }

    public List<AttributionRow> supplierAttribution(
            int fiscalYear,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    supplier.legal_name
                        AS label,

                    COALESCE(
                        SUM(
                            initiative.target_savings
                        ),
                        0
                    )
                        AS target_savings,

                    COALESCE(
                        SUM(
                            initiative.realized_savings
                        ),
                        0
                    )
                        AS realized_savings,

                    COUNT(*)
                        AS initiative_count

                FROM procurement_savings_initiatives initiative

                JOIN suppliers supplier
                    ON supplier.id =
                       initiative.supplier_id

                WHERE initiative.fiscal_year = ?
                AND initiative.currency = ?
                AND initiative.status IN (
                    'VALIDATED',
                    'CLOSED'
                )

                GROUP BY
                    supplier.id,
                    supplier.legal_name

                ORDER BY
                    realized_savings DESC,
                    target_savings DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new AttributionRow(
                                resultSet.getString(
                                        "label"
                                ),
                                resultSet.getBigDecimal(
                                        "target_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "realized_savings"
                                ),
                                resultSet.getLong(
                                        "initiative_count"
                                )
                        ),
                fiscalYear,
                currency
        );
    }

    public List<AttributionRow> categoryAttribution(
            int fiscalYear,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    COALESCE(
                        initiative.category,
                        'Uncategorized'
                    )
                        AS label,

                    COALESCE(
                        SUM(
                            initiative.target_savings
                        ),
                        0
                    )
                        AS target_savings,

                    COALESCE(
                        SUM(
                            initiative.realized_savings
                        ),
                        0
                    )
                        AS realized_savings,

                    COUNT(*)
                        AS initiative_count

                FROM procurement_savings_initiatives initiative

                WHERE initiative.fiscal_year = ?
                AND initiative.currency = ?
                AND initiative.status IN (
                    'VALIDATED',
                    'CLOSED'
                )

                GROUP BY
                    COALESCE(
                        initiative.category,
                        'Uncategorized'
                    )

                ORDER BY
                    realized_savings DESC,
                    target_savings DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new AttributionRow(
                                resultSet.getString(
                                        "label"
                                ),
                                resultSet.getBigDecimal(
                                        "target_savings"
                                ),
                                resultSet.getBigDecimal(
                                        "realized_savings"
                                ),
                                resultSet.getLong(
                                        "initiative_count"
                                )
                        ),
                fiscalYear,
                currency
        );
    }

    public List<SavingsUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role
                FROM app_users
                WHERE active = TRUE
                ORDER BY full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SavingsUserOptionResponse(
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

    public List<SavingsSupplierOptionResponse> suppliers() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name,
                    category
                FROM suppliers
                WHERE status = 'ACTIVE'
                ORDER BY legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SavingsSupplierOptionResponse(
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
                                )
                        )
        );
    }

    public List<SavingsRfqOptionResponse> rfqs() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    rfq_number,
                    title,
                    currency,
                    status
                FROM rfqs
                ORDER BY created_at DESC
                LIMIT 150
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SavingsRfqOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "rfq_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getString(
                                        "status"
                                )
                        )
        );
    }

    public List<SavingsPurchaseOrderOptionResponse>
    purchaseOrders() {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order.id,
                    purchase_order.po_number,
                    purchase_order.rfq_id,
                    purchase_order.supplier_id,
                    supplier.legal_name
                        AS supplier_name,
                    purchase_order.currency,
                    purchase_order.total_amount,
                    purchase_order.status
                FROM purchase_orders purchase_order
                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id
                WHERE purchase_order.status
                    <> 'CANCELLED'
                ORDER BY
                    purchase_order.created_at DESC
                LIMIT 150
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SavingsPurchaseOrderOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "po_number"
                                ),
                                resultSet.getObject(
                                        "rfq_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "supplier_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "supplier_name"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "total_amount"
                                ),
                                resultSet.getString(
                                        "status"
                                )
                        )
        );
    }

    public List<String> categories() {
        return jdbcTemplate.queryForList(
                """
                SELECT DISTINCT category
                FROM (
                    SELECT category
                    FROM suppliers

                    UNION

                    SELECT category
                    FROM purchase_order_lines

                    UNION

                    SELECT category
                    FROM procurement_savings_initiatives
                ) categories
                WHERE category IS NOT NULL
                AND category <> ''
                ORDER BY category
                """,
                String.class
        );
    }

    private String initiativeSql() {
        return """
                SELECT
                    initiative.id,
                    initiative.savings_number,
                    initiative.source_key,
                    initiative.origin,
                    initiative.title,
                    initiative.savings_type,
                    initiative.status,
                    initiative.fiscal_year,
                    initiative.currency,
                    initiative.category,

                    initiative.rfq_id,
                    rfq.rfq_number,

                    initiative.supplier_id,
                    supplier.legal_name
                        AS supplier_name,

                    initiative.purchase_order_id,
                    purchase_order.po_number,

                    initiative.baseline_value,
                    initiative.negotiated_value,
                    initiative.target_savings,
                    initiative.realized_savings,

                    initiative.owner_user_id,
                    owner.full_name
                        AS owner_name,

                    initiative.decision_note,
                    initiative.decision_at,

                    decision_user.full_name
                        AS decided_by_name,

                    initiative.notes,
                    initiative.created_at,
                    initiative.updated_at,
                    initiative.version

                FROM procurement_savings_initiatives initiative

                JOIN app_users owner
                    ON owner.id =
                       initiative.owner_user_id

                LEFT JOIN app_users decision_user
                    ON decision_user.id =
                       initiative.decided_by_user_id

                LEFT JOIN rfqs rfq
                    ON rfq.id =
                       initiative.rfq_id

                LEFT JOIN suppliers supplier
                    ON supplier.id =
                       initiative.supplier_id

                LEFT JOIN purchase_orders purchase_order
                    ON purchase_order.id =
                       initiative.purchase_order_id

                """;
    }

    private InitiativeRow mapInitiative(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp decision =
                resultSet.getTimestamp(
                        "decision_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new InitiativeRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "savings_number"
                ),
                resultSet.getString(
                        "source_key"
                ),
                SavingsOrigin.valueOf(
                        resultSet.getString(
                                "origin"
                        )
                ),
                resultSet.getString(
                        "title"
                ),
                SavingsType.valueOf(
                        resultSet.getString(
                                "savings_type"
                        )
                ),
                SavingsStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getInt(
                        "fiscal_year"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getString(
                        "category"
                ),
                resultSet.getObject(
                        "rfq_id",
                        UUID.class
                ),
                resultSet.getString(
                        "rfq_number"
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                resultSet.getString(
                        "supplier_name"
                ),
                resultSet.getObject(
                        "purchase_order_id",
                        UUID.class
                ),
                resultSet.getString(
                        "po_number"
                ),
                resultSet.getBigDecimal(
                        "baseline_value"
                ),
                resultSet.getBigDecimal(
                        "negotiated_value"
                ),
                resultSet.getBigDecimal(
                        "target_savings"
                ),
                resultSet.getBigDecimal(
                        "realized_savings"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getString(
                        "decision_note"
                ),
                decision == null
                        ? null
                        : decision.toInstant(),
                resultSet.getString(
                        "decided_by_name"
                ),
                resultSet.getString(
                        "notes"
                ),
                created.toInstant(),
                updated.toInstant(),
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

    public record InitiativeRow(
            UUID id,
            String savingsNumber,
            String sourceKey,
            SavingsOrigin origin,
            String title,
            SavingsType savingsType,
            SavingsStatus status,
            int fiscalYear,
            String currency,
            String category,
            UUID rfqId,
            String rfqNumber,
            UUID supplierId,
            String supplierName,
            UUID purchaseOrderId,
            String purchaseOrderNumber,
            BigDecimal baselineValue,
            BigDecimal negotiatedValue,
            BigDecimal targetSavings,
            BigDecimal realizedSavings,
            UUID ownerUserId,
            String ownerName,
            String decisionNote,
            Instant decisionAt,
            String decidedByName,
            String notes,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record RealizationRow(
            UUID id,
            SavingsRealizationSourceType sourceType,
            UUID purchaseOrderId,
            String purchaseOrderNumber,
            LocalDate realizationDate,
            BigDecimal amount,
            String notes,
            UUID createdByUserId,
            String createdByName,
            Instant createdAt
    ) {
    }

    public record OpportunityRow(
            UUID awardId,
            String sourceKey,
            int fiscalYear,
            UUID rfqId,
            String rfqNumber,
            String currency,
            UUID supplierId,
            String supplierName,
            String category,
            BigDecimal baselineValue,
            BigDecimal negotiatedValue,
            BigDecimal targetSavings,
            UUID purchaseOrderId,
            String purchaseOrderNumber,
            BigDecimal purchaseOrderTotal,
            Instant purchaseOrderDate
    ) {
    }

    public record AttributionRow(
            String label,
            BigDecimal targetSavings,
            BigDecimal realizedSavings,
            long initiativeCount
    ) {
    }
}
