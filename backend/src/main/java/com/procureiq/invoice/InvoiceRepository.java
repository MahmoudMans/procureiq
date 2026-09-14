package com.procureiq.invoice;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class InvoiceRepository {

    private final JdbcTemplate jdbcTemplate;

    public InvoiceRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextInvoiceSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'procurement_invoice_number_seq'
                )
                """,
                Long.class
        );
    }

    public PurchaseOrderRow findPurchaseOrder(
            UUID purchaseOrderId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order.id,
                    purchase_order.po_number,
                    purchase_order.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    purchase_order.currency,
                    purchase_order.total_amount,
                    purchase_order.status

                FROM purchase_orders
                    purchase_order

                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id

                WHERE purchase_order.id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new PurchaseOrderRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "po_number"
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
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "total_amount"
                                ),
                                resultSet.getString(
                                        "status"
                                )
                        ),
                purchaseOrderId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<InvoicePurchaseOrderOptionResponse> purchaseOrders() {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order.id,
                    purchase_order.po_number,
                    purchase_order.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    purchase_order.currency,
                    purchase_order.total_amount,
                    purchase_order.status

                FROM purchase_orders
                    purchase_order

                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id

                WHERE purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )

                ORDER BY
                    purchase_order.created_at DESC

                LIMIT 200
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new InvoicePurchaseOrderOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "po_number"
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

    public void createInvoice(
            UUID id,
            String invoiceNumber,
            ProcurementInvoiceInput input,
            PurchaseOrderRow purchaseOrder,
            UUID currentUserId,
            String currency,
            BigDecimal subtotal,
            BigDecimal total
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_invoices (
                    id,
                    invoice_number,
                    supplier_invoice_number,
                    supplier_id,
                    purchase_order_id,
                    invoice_date,
                    due_date,
                    currency,
                    subtotal_amount,
                    tax_amount,
                    total_amount,
                    po_variance_tolerance_pct,
                    status,
                    match_status,
                    payment_hold,
                    hold_reason,
                    created_by_user_id,
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
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'MATCH_PENDING',
                    'NOT_RUN',
                    TRUE,
                    'Awaiting three-way match',
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                invoiceNumber,
                input.supplierInvoiceNumber()
                        .trim(),
                purchaseOrder.supplierId(),
                purchaseOrder.id(),
                input.invoiceDate(),
                input.dueDate(),
                currency,
                subtotal,
                input.taxAmount(),
                total,
                input.poVarianceTolerancePct(),
                currentUserId,
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public void createLine(
            UUID invoiceId,
            ProcurementInvoiceLineInput line,
            BigDecimal lineTotal
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_invoice_lines (
                    id,
                    invoice_id,
                    line_number,
                    description,
                    quantity,
                    unit_price,
                    line_total,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                invoiceId,
                line.lineNumber(),
                line.description()
                        .trim(),
                line.quantity(),
                line.unitPrice(),
                lineTotal
        );
    }

    public InvoiceRow findInvoice(
            UUID invoiceId
    ) {
        return jdbcTemplate.query(
                invoiceSql()
                        + """
                        WHERE invoice.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapInvoice(
                                resultSet
                        ),
                invoiceId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<InvoiceRow> findInvoices(
            String currency
    ) {
        return jdbcTemplate.query(
                invoiceSql()
                        + """
                        WHERE invoice.currency = ?
                        ORDER BY
                            CASE invoice.status
                                WHEN 'EXCEPTION'
                                THEN 1
                                WHEN 'PAYMENT_HOLD'
                                THEN 2
                                WHEN 'MATCH_PENDING'
                                THEN 3
                                WHEN 'MATCHED'
                                THEN 4
                                WHEN 'APPROVED'
                                THEN 5
                                WHEN 'READY_FOR_PAYMENT'
                                THEN 6
                                WHEN 'PAID'
                                THEN 7
                                ELSE 8
                            END,
                            invoice.due_date,
                            invoice.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapInvoice(
                                resultSet
                        ),
                currency
        );
    }

    public List<LineRow> findLines(
            UUID invoiceId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    line_number,
                    description,
                    quantity,
                    unit_price,
                    line_total
                FROM procurement_invoice_lines
                WHERE invoice_id = ?
                ORDER BY
                    line_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new LineRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getInt(
                                        "line_number"
                                ),
                                resultSet.getString(
                                        "description"
                                ),
                                resultSet.getBigDecimal(
                                        "quantity"
                                ),
                                resultSet.getBigDecimal(
                                        "unit_price"
                                ),
                                resultSet.getBigDecimal(
                                        "line_total"
                                )
                        ),
                invoiceId
        );
    }

    public long duplicateInvoiceCount(
            UUID invoiceId,
            UUID supplierId,
            String supplierInvoiceNumber
    ) {
        Long result =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM procurement_invoices
                        WHERE supplier_id = ?
                        AND LOWER(
                            supplier_invoice_number
                        ) = LOWER(?)
                        AND id <> ?
                        AND status
                            <> 'CANCELLED'
                        """,
                        Long.class,
                        supplierId,
                        supplierInvoiceNumber,
                        invoiceId
                );

        return result == null
                ? 0
                : result;
    }

    public BigDecimal otherInvoicedValueForPo(
            UUID purchaseOrderId,
            UUID invoiceId
    ) {
        BigDecimal result =
                jdbcTemplate.queryForObject(
                        """
                        SELECT
                            COALESCE(
                                SUM(total_amount),
                                0
                            )
                        FROM procurement_invoices
                        WHERE purchase_order_id = ?
                        AND id <> ?
                        AND status
                            <> 'CANCELLED'
                        """,
                        BigDecimal.class,
                        purchaseOrderId,
                        invoiceId
                );

        return result == null
                ? BigDecimal.ZERO
                : result;
    }

    public void resetOpenMatchingExceptions(
            UUID invoiceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE invoice_match_exceptions
                SET
                    status =
                        'RESOLVED',
                    resolution_note =
                        'Superseded by subsequent automated match evaluation.',
                    resolved_by_user_id =
                        NULL,
                    resolved_at =
                        CURRENT_TIMESTAMP,
                    last_checked_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE invoice_id = ?
                AND status =
                    'OPEN'
                """,
                invoiceId
        );
    }

    public void upsertException(
            UUID invoiceId,
            InvoiceExceptionCandidate candidate
    ) {
        String key =
                invoiceId
                        + ":"
                        + candidate.exceptionType()
                                .name();

        jdbcTemplate.update(
                """
                INSERT INTO invoice_match_exceptions (
                    id,
                    invoice_id,
                    exception_key,
                    exception_type,
                    severity,
                    status,
                    expected_value,
                    actual_value,
                    variance_amount,
                    details,
                    detected_at,
                    last_checked_at,
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
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )

                ON CONFLICT (
                    exception_key
                )

                DO UPDATE SET
                    severity =
                        EXCLUDED.severity,
                    status =
                        'OPEN',
                    expected_value =
                        EXCLUDED.expected_value,
                    actual_value =
                        EXCLUDED.actual_value,
                    variance_amount =
                        EXCLUDED.variance_amount,
                    details =
                        EXCLUDED.details,
                    last_checked_at =
                        CURRENT_TIMESTAMP,
                    resolved_by_user_id =
                        NULL,
                    resolution_note =
                        NULL,
                    resolved_at =
                        NULL,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        invoice_match_exceptions.version
                        + 1
                """,
                UUID.randomUUID(),
                invoiceId,
                key,
                candidate.exceptionType()
                        .name(),
                candidate.severity()
                        .name(),
                candidate.expectedValue(),
                candidate.actualValue(),
                candidate.varianceAmount(),
                candidate.details()
        );
    }

    public long openExceptionCount(
            UUID invoiceId
    ) {
        Long result =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM invoice_match_exceptions
                        WHERE invoice_id = ?
                        AND status =
                            'OPEN'
                        """,
                        Long.class,
                        invoiceId
                );

        return result == null
                ? 0
                : result;
    }

    public void updateMatchResult(
            UUID invoiceId,
            boolean matched
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_invoices
                SET
                    status =
                        CASE
                            WHEN ?
                            THEN 'MATCHED'
                            ELSE 'EXCEPTION'
                        END,
                    match_status =
                        CASE
                            WHEN ?
                            THEN 'MATCHED'
                            ELSE 'EXCEPTION'
                        END,
                    payment_hold =
                        CASE
                            WHEN ?
                            THEN FALSE
                            ELSE TRUE
                        END,
                    hold_reason =
                        CASE
                            WHEN ?
                            THEN NULL
                            ELSE 'Open three-way match exceptions'
                        END,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'MATCH_PENDING',
                    'MATCHED',
                    'EXCEPTION'
                )
                """,
                matched,
                matched,
                matched,
                matched,
                invoiceId
        );
    }

    public ExceptionRow findException(
            UUID exceptionId
    ) {
        return jdbcTemplate.query(
                exceptionSql()
                        + """
                        WHERE exception.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapException(
                                resultSet
                        ),
                exceptionId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ExceptionRow> findExceptions(
            UUID invoiceId
    ) {
        return jdbcTemplate.query(
                exceptionSql()
                        + """
                        WHERE exception.invoice_id = ?
                        ORDER BY
                            CASE exception.status
                                WHEN 'OPEN'
                                THEN 1
                                ELSE 2
                            END,
                            CASE exception.severity
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                WHEN 'MEDIUM'
                                THEN 3
                                ELSE 4
                            END,
                            exception.detected_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapException(
                                resultSet
                        ),
                invoiceId
        );
    }

    public void decideException(
            UUID exceptionId,
            UUID currentUserId,
            String note,
            InvoiceExceptionStatus status
    ) {
        jdbcTemplate.update(
                """
                UPDATE invoice_match_exceptions
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
                AND status =
                    'OPEN'
                """,
                status.name(),
                currentUserId,
                note.trim(),
                exceptionId
        );
    }

    public void releaseExceptionInvoiceIfClear(
            UUID invoiceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_invoices
                SET
                    status =
                        'MATCHED',
                    match_status =
                        'MATCHED',
                    payment_hold =
                        FALSE,
                    hold_reason =
                        NULL,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'EXCEPTION'
                AND NOT EXISTS (
                    SELECT 1
                    FROM invoice_match_exceptions
                        exception
                    WHERE
                        exception.invoice_id =
                            procurement_invoices.id
                    AND exception.status =
                        'OPEN'
                )
                """,
                invoiceId
        );
    }

    public void approveInvoice(
            UUID invoiceId,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_invoices
                SET
                    status =
                        'APPROVED',
                    approved_by_user_id = ?,
                    approved_at =
                        CURRENT_TIMESTAMP,
                    payment_hold =
                        FALSE,
                    hold_reason =
                        NULL,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'MATCHED'
                """,
                currentUserId,
                invoiceId
        );
    }

    public void placePaymentHold(
            UUID invoiceId,
            String reason
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_invoices
                SET
                    status =
                        'PAYMENT_HOLD',
                    payment_hold =
                        TRUE,
                    hold_reason = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'MATCHED',
                    'APPROVED',
                    'READY_FOR_PAYMENT'
                )
                """,
                reason.trim(),
                invoiceId
        );
    }

    public void releasePaymentHold(
            UUID invoiceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_invoices
                SET
                    status =
                        'READY_FOR_PAYMENT',
                    payment_hold =
                        FALSE,
                    hold_reason =
                        NULL,
                    ready_for_payment_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'PAYMENT_HOLD'
                AND NOT EXISTS (
                    SELECT 1
                    FROM invoice_match_exceptions
                        exception
                    WHERE
                        exception.invoice_id =
                            procurement_invoices.id
                    AND exception.status =
                        'OPEN'
                )
                """,
                invoiceId
        );
    }

    public void markReadyForPayment(
            UUID invoiceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_invoices
                SET
                    status =
                        'READY_FOR_PAYMENT',
                    ready_for_payment_at =
                        CURRENT_TIMESTAMP,
                    payment_hold =
                        FALSE,
                    hold_reason =
                        NULL,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'APPROVED'
                """,
                invoiceId
        );
    }

    public void markPaid(
            UUID invoiceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_invoices
                SET
                    status =
                        'PAID',
                    paid_at =
                        CURRENT_TIMESTAMP,
                    payment_hold =
                        FALSE,
                    hold_reason =
                        NULL,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'READY_FOR_PAYMENT'
                """,
                invoiceId
        );
    }

    public void cancelInvoice(
            UUID invoiceId,
            String reason
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_invoices
                SET
                    status =
                        'CANCELLED',
                    payment_hold =
                        TRUE,
                    hold_reason = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status
                    <> 'PAID'
                AND status
                    <> 'CANCELLED'
                """,
                reason.trim(),
                invoiceId
        );
    }

    private String invoiceSql() {
        return """
                SELECT
                    invoice.id,
                    invoice.invoice_number,
                    invoice.supplier_invoice_number,

                    invoice.supplier_id,
                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    invoice.purchase_order_id,
                    purchase_order.po_number,
                    purchase_order.status
                        AS purchase_order_status,
                    purchase_order.currency
                        AS purchase_order_currency,
                    purchase_order.total_amount
                        AS purchase_order_total,

                    invoice.invoice_date,
                    invoice.due_date,
                    invoice.currency,

                    invoice.subtotal_amount,
                    invoice.tax_amount,
                    invoice.total_amount,
                    invoice.po_variance_tolerance_pct,

                    invoice.status,
                    invoice.match_status,
                    invoice.payment_hold,
                    invoice.hold_reason,

                    approver.full_name
                        AS approved_by_name,

                    invoice.approved_at,
                    invoice.ready_for_payment_at,
                    invoice.paid_at,

                    invoice.created_by_user_id,

                    creator.full_name
                        AS created_by_name,

                    invoice.notes,

                    (
                        SELECT COUNT(*)
                        FROM invoice_match_exceptions
                            exception
                        WHERE
                            exception.invoice_id =
                                invoice.id
                        AND exception.status =
                            'OPEN'
                    )
                        AS open_exceptions,

                    (
                        SELECT COALESCE(
                            SUM(other_invoice.total_amount),
                            0
                        )
                        FROM procurement_invoices
                            other_invoice
                        WHERE
                            other_invoice.purchase_order_id =
                                invoice.purchase_order_id
                        AND other_invoice.status
                            <> 'CANCELLED'
                    )
                        AS cumulative_invoiced_value,

                    invoice.created_at,
                    invoice.updated_at,
                    invoice.version

                FROM procurement_invoices invoice

                JOIN suppliers supplier
                    ON supplier.id =
                       invoice.supplier_id

                JOIN purchase_orders
                    purchase_order
                    ON purchase_order.id =
                       invoice.purchase_order_id

                JOIN app_users creator
                    ON creator.id =
                       invoice.created_by_user_id

                LEFT JOIN app_users approver
                    ON approver.id =
                       invoice.approved_by_user_id

                """;
    }

    private String exceptionSql() {
        return """
                SELECT
                    exception.id,
                    exception.invoice_id,
                    exception.exception_type,
                    exception.severity,
                    exception.status,
                    exception.expected_value,
                    exception.actual_value,
                    exception.variance_amount,
                    exception.details,
                    exception.detected_at,
                    exception.last_checked_at,
                    exception.resolution_note,
                    exception.resolved_at,

                    resolver.full_name
                        AS resolved_by_name,

                    exception.created_at,
                    exception.updated_at,
                    exception.version

                FROM invoice_match_exceptions
                    exception

                LEFT JOIN app_users resolver
                    ON resolver.id =
                       exception.resolved_by_user_id

                """;
    }

    private InvoiceRow mapInvoice(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp approved =
                resultSet.getTimestamp(
                        "approved_at"
                );

        Timestamp ready =
                resultSet.getTimestamp(
                        "ready_for_payment_at"
                );

        Timestamp paid =
                resultSet.getTimestamp(
                        "paid_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new InvoiceRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "invoice_number"
                ),
                resultSet.getString(
                        "supplier_invoice_number"
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
                resultSet.getObject(
                        "purchase_order_id",
                        UUID.class
                ),
                resultSet.getString(
                        "po_number"
                ),
                resultSet.getString(
                        "purchase_order_status"
                ),
                resultSet.getString(
                        "purchase_order_currency"
                ),
                resultSet.getBigDecimal(
                        "purchase_order_total"
                ),
                resultSet.getObject(
                        "invoice_date",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getBigDecimal(
                        "subtotal_amount"
                ),
                resultSet.getBigDecimal(
                        "tax_amount"
                ),
                resultSet.getBigDecimal(
                        "total_amount"
                ),
                resultSet.getBigDecimal(
                        "po_variance_tolerance_pct"
                ),
                ProcurementInvoiceStatus
                        .valueOf(
                                resultSet.getString(
                                        "status"
                                )
                        ),
                InvoiceMatchStatus
                        .valueOf(
                                resultSet.getString(
                                        "match_status"
                                )
                        ),
                resultSet.getBoolean(
                        "payment_hold"
                ),
                resultSet.getString(
                        "hold_reason"
                ),
                resultSet.getString(
                        "approved_by_name"
                ),
                approved == null
                        ? null
                        : approved.toInstant(),
                ready == null
                        ? null
                        : ready.toInstant(),
                paid == null
                        ? null
                        : paid.toInstant(),
                resultSet.getObject(
                        "created_by_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "created_by_name"
                ),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getLong(
                        "open_exceptions"
                ),
                resultSet.getBigDecimal(
                        "cumulative_invoiced_value"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private ExceptionRow mapException(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp detected =
                resultSet.getTimestamp(
                        "detected_at"
                );

        Timestamp checked =
                resultSet.getTimestamp(
                        "last_checked_at"
                );

        Timestamp resolved =
                resultSet.getTimestamp(
                        "resolved_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new ExceptionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "invoice_id",
                        UUID.class
                ),
                InvoiceExceptionType
                        .valueOf(
                                resultSet.getString(
                                        "exception_type"
                                )
                        ),
                InvoiceExceptionSeverity
                        .valueOf(
                                resultSet.getString(
                                        "severity"
                                )
                        ),
                InvoiceExceptionStatus
                        .valueOf(
                                resultSet.getString(
                                        "status"
                                )
                        ),
                resultSet.getBigDecimal(
                        "expected_value"
                ),
                resultSet.getBigDecimal(
                        "actual_value"
                ),
                resultSet.getBigDecimal(
                        "variance_amount"
                ),
                resultSet.getString(
                        "details"
                ),
                detected.toInstant(),
                checked.toInstant(),
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

    public record PurchaseOrderRow(
            UUID id,
            String purchaseOrderNumber,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String currency,
            BigDecimal totalAmount,
            String status
    ) {
    }

    public record InvoiceRow(
            UUID id,
            String invoiceNumber,
            String supplierInvoiceNumber,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            UUID purchaseOrderId,
            String purchaseOrderNumber,
            String purchaseOrderStatus,
            String purchaseOrderCurrency,
            BigDecimal purchaseOrderTotal,
            LocalDate invoiceDate,
            LocalDate dueDate,
            String currency,
            BigDecimal subtotalAmount,
            BigDecimal taxAmount,
            BigDecimal totalAmount,
            BigDecimal poVarianceTolerancePct,
            ProcurementInvoiceStatus status,
            InvoiceMatchStatus matchStatus,
            boolean paymentHold,
            String holdReason,
            String approvedByName,
            Instant approvedAt,
            Instant readyForPaymentAt,
            Instant paidAt,
            UUID createdByUserId,
            String createdByName,
            String notes,
            long openExceptions,
            BigDecimal cumulativeInvoicedValue,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record LineRow(
            UUID id,
            int lineNumber,
            String description,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal
    ) {
    }

    public record ExceptionRow(
            UUID id,
            UUID invoiceId,
            InvoiceExceptionType exceptionType,
            InvoiceExceptionSeverity severity,
            InvoiceExceptionStatus status,
            BigDecimal expectedValue,
            BigDecimal actualValue,
            BigDecimal varianceAmount,
            String details,
            Instant detectedAt,
            Instant lastCheckedAt,
            String resolutionNote,
            Instant resolvedAt,
            String resolvedByName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record InvoiceExceptionCandidate(
            InvoiceExceptionType exceptionType,
            InvoiceExceptionSeverity severity,
            BigDecimal expectedValue,
            BigDecimal actualValue,
            BigDecimal varianceAmount,
            String details
    ) {
    }
}
