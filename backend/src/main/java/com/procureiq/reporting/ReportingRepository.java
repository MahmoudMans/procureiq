package com.procureiq.reporting;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Repository
public class ReportingRepository {

    private final JdbcTemplate jdbcTemplate;

    public ReportingRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public BigDecimal committedSpend(
            LocalDate from,
            LocalDate to
    ) {
        return decimal(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            SUM(total_amount),
                            0
                        )
                        FROM purchase_orders
                        WHERE status IN (
                            'ISSUED',
                            'PARTIALLY_RECEIVED',
                            'RECEIVED'
                        )
                        AND COALESCE(
                            issued_at::date,
                            created_at::date
                        ) BETWEEN ? AND ?
                        """,
                        BigDecimal.class,
                        from,
                        to
                )
        );
    }

    public long purchaseOrderCount(
            LocalDate from,
            LocalDate to
    ) {
        return number(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM purchase_orders
                        WHERE status IN (
                            'ISSUED',
                            'PARTIALLY_RECEIVED',
                            'RECEIVED'
                        )
                        AND COALESCE(
                            issued_at::date,
                            created_at::date
                        ) BETWEEN ? AND ?
                        """,
                        Long.class,
                        from,
                        to
                )
        );
    }

    public long supplierCount(
            LocalDate from,
            LocalDate to
    ) {
        return number(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(
                            DISTINCT supplier_id
                        )
                        FROM purchase_orders
                        WHERE status IN (
                            'ISSUED',
                            'PARTIALLY_RECEIVED',
                            'RECEIVED'
                        )
                        AND COALESCE(
                            issued_at::date,
                            created_at::date
                        ) BETWEEN ? AND ?
                        """,
                        Long.class,
                        from,
                        to
                )
        );
    }

    public long overdueOrderCount(
            LocalDate from,
            LocalDate to
    ) {
        return number(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM purchase_orders
                        WHERE status IN (
                            'ISSUED',
                            'PARTIALLY_RECEIVED'
                        )
                        AND expected_delivery_date
                            < CURRENT_DATE
                        AND expected_delivery_date
                            BETWEEN ? AND ?
                        """,
                        Long.class,
                        from,
                        to
                )
        );
    }

    public BigDecimal sourcingSavings(
            LocalDate from,
            LocalDate to
    ) {
        return decimal(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            SUM(
                                GREATEST(
                                    submitted.maximum_total
                                    - selected.total_amount,
                                    0
                                )
                            ),
                            0
                        )
                        FROM award_decisions award
                        JOIN quotations selected
                            ON selected.id =
                               award.selected_quotation_id
                        JOIN (
                            SELECT
                                rfq_id,
                                MAX(total_amount)
                                    AS maximum_total
                            FROM quotations
                            WHERE status = 'SUBMITTED'
                            GROUP BY rfq_id
                        ) submitted
                            ON submitted.rfq_id =
                               award.rfq_id
                        WHERE award.decided_at::date
                            BETWEEN ? AND ?
                        """,
                        BigDecimal.class,
                        from,
                        to
                )
        );
    }

    public BigDecimal averageCycleDays(
            LocalDate from,
            LocalDate to
    ) {
        return decimal(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            ROUND(
                                AVG(
                                    EXTRACT(
                                        EPOCH FROM (
                                            award.decided_at
                                            - request.submitted_at
                                        )
                                    ) / 86400.0
                                )::numeric,
                                2
                            ),
                            0
                        )
                        FROM award_decisions award
                        JOIN rfqs rfq
                            ON rfq.id =
                               award.rfq_id
                        JOIN purchase_requests request
                            ON request.id =
                               rfq.source_purchase_request_id
                        WHERE request.submitted_at
                            IS NOT NULL
                        AND award.decided_at::date
                            BETWEEN ? AND ?
                        """,
                        BigDecimal.class,
                        from,
                        to
                )
        );
    }

    public List<ValueRow> spendBySupplier(
            LocalDate from,
            LocalDate to
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    supplier.legal_name
                        AS label,
                    COALESCE(
                        SUM(purchase_order.total_amount),
                        0
                    ) AS amount,
                    COUNT(*)
                        AS item_count
                FROM purchase_orders purchase_order
                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id
                WHERE purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )
                AND COALESCE(
                    purchase_order.issued_at::date,
                    purchase_order.created_at::date
                ) BETWEEN ? AND ?
                GROUP BY
                    supplier.id,
                    supplier.legal_name
                ORDER BY
                    amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ValueRow(
                                resultSet.getString(
                                        "label"
                                ),
                                resultSet.getBigDecimal(
                                        "amount"
                                ),
                                resultSet.getLong(
                                        "item_count"
                                )
                        ),
                from,
                to
        );
    }

    public List<ValueRow> spendByCategory(
            LocalDate from,
            LocalDate to
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    line.category
                        AS label,
                    COALESCE(
                        SUM(line.line_total),
                        0
                    ) AS amount,
                    COUNT(*)
                        AS item_count
                FROM purchase_order_lines line
                JOIN purchase_orders purchase_order
                    ON purchase_order.id =
                       line.purchase_order_id
                WHERE purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )
                AND COALESCE(
                    purchase_order.issued_at::date,
                    purchase_order.created_at::date
                ) BETWEEN ? AND ?
                GROUP BY
                    line.category
                ORDER BY
                    amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ValueRow(
                                resultSet.getString(
                                        "label"
                                ),
                                resultSet.getBigDecimal(
                                        "amount"
                                ),
                                resultSet.getLong(
                                        "item_count"
                                )
                        ),
                from,
                to
        );
    }

    public List<SourcingSavingsReportRow>
    sourcingRows(
            LocalDate from,
            LocalDate to
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    rfq.rfq_number,
                    supplier.legal_name
                        AS supplier_name,
                    selected.total_amount
                        AS selected_total,
                    submitted.maximum_total
                        AS highest_total,
                    GREATEST(
                        submitted.maximum_total
                        - selected.total_amount,
                        0
                    ) AS savings,
                    award.decided_at::date
                        AS award_date
                FROM award_decisions award
                JOIN rfqs rfq
                    ON rfq.id =
                       award.rfq_id
                JOIN quotations selected
                    ON selected.id =
                       award.selected_quotation_id
                JOIN suppliers supplier
                    ON supplier.id =
                       selected.supplier_id
                JOIN (
                    SELECT
                        rfq_id,
                        MAX(total_amount)
                            AS maximum_total
                    FROM quotations
                    WHERE status = 'SUBMITTED'
                    GROUP BY rfq_id
                ) submitted
                    ON submitted.rfq_id =
                       award.rfq_id
                WHERE award.decided_at::date
                    BETWEEN ? AND ?
                ORDER BY
                    award.decided_at DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SourcingSavingsReportRow(
                                resultSet.getString(
                                        "rfq_number"
                                ),
                                resultSet.getString(
                                        "supplier_name"
                                ),
                                resultSet.getBigDecimal(
                                        "selected_total"
                                ),
                                resultSet.getBigDecimal(
                                        "highest_total"
                                ),
                                resultSet.getBigDecimal(
                                        "savings"
                                ),
                                resultSet.getObject(
                                        "award_date",
                                        LocalDate.class
                                )
                        ),
                from,
                to
        );
    }

    public List<PurchaseOrderReportRow>
    purchaseOrders(
            LocalDate from,
            LocalDate to
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order.po_number,
                    supplier.legal_name
                        AS supplier_name,
                    purchase_order.status,
                    purchase_order.total_amount,
                    purchase_order.expected_delivery_date,
                    purchase_order.issued_at
                FROM purchase_orders purchase_order
                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id
                WHERE COALESCE(
                    purchase_order.issued_at::date,
                    purchase_order.created_at::date
                ) BETWEEN ? AND ?
                ORDER BY
                    COALESCE(
                        purchase_order.issued_at,
                        purchase_order.created_at
                    ) DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp issuedAt =
                            resultSet.getTimestamp(
                                    "issued_at"
                            );

                    return new PurchaseOrderReportRow(
                            resultSet.getString(
                                    "po_number"
                            ),
                            resultSet.getString(
                                    "supplier_name"
                            ),
                            resultSet.getString(
                                    "status"
                            ),
                            resultSet.getBigDecimal(
                                    "total_amount"
                            ),
                            resultSet.getObject(
                                    "expected_delivery_date",
                                    LocalDate.class
                            ),
                            issuedAt == null
                                    ? null
                                    : issuedAt.toInstant()
                    );
                },
                from,
                to
        );
    }

    public List<DeliveryReportRow>
    deliveries(
            LocalDate from,
            LocalDate to
    ) {
        return jdbcTemplate.query(
                """
                WITH ordered AS (
                    SELECT
                        purchase_order_id,
                        SUM(quantity)
                            AS ordered_quantity
                    FROM purchase_order_lines
                    GROUP BY
                        purchase_order_id
                ),
                received AS (
                    SELECT
                        receipt.purchase_order_id,
                        SUM(line.quantity_received)
                            AS received_quantity,
                        MAX(receipt.received_date)
                            AS last_receipt_date
                    FROM goods_receipts receipt
                    JOIN goods_receipt_lines line
                        ON line.goods_receipt_id =
                           receipt.id
                    GROUP BY
                        receipt.purchase_order_id
                )
                SELECT
                    purchase_order.po_number,
                    supplier.legal_name
                        AS supplier_name,
                    purchase_order.status,
                    purchase_order.expected_delivery_date,
                    received.last_receipt_date,
                    COALESCE(
                        ordered.ordered_quantity,
                        0
                    ) AS ordered_quantity,
                    COALESCE(
                        received.received_quantity,
                        0
                    ) AS received_quantity,
                    CASE
                        WHEN COALESCE(
                            ordered.ordered_quantity,
                            0
                        ) = 0
                        THEN 0
                        ELSE LEAST(
                            100,
                            (
                                COALESCE(
                                    received.received_quantity,
                                    0
                                )
                                /
                                ordered.ordered_quantity
                            )
                            * 100
                        )
                    END AS fulfillment_rate,
                    CASE
                        WHEN received.last_receipt_date
                            IS NOT NULL
                        THEN received.last_receipt_date
                             >
                             purchase_order.expected_delivery_date
                        ELSE
                            purchase_order.expected_delivery_date
                            < CURRENT_DATE
                            AND purchase_order.status IN (
                                'ISSUED',
                                'PARTIALLY_RECEIVED'
                            )
                    END AS late
                FROM purchase_orders purchase_order
                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id
                LEFT JOIN ordered
                    ON ordered.purchase_order_id =
                       purchase_order.id
                LEFT JOIN received
                    ON received.purchase_order_id =
                       purchase_order.id
                WHERE purchase_order.expected_delivery_date
                    BETWEEN ? AND ?
                AND purchase_order.status <> 'CANCELLED'
                ORDER BY
                    purchase_order.expected_delivery_date DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new DeliveryReportRow(
                                resultSet.getString(
                                        "po_number"
                                ),
                                resultSet.getString(
                                        "supplier_name"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getObject(
                                        "expected_delivery_date",
                                        LocalDate.class
                                ),
                                resultSet.getObject(
                                        "last_receipt_date",
                                        LocalDate.class
                                ),
                                resultSet.getBigDecimal(
                                        "ordered_quantity"
                                ),
                                resultSet.getBigDecimal(
                                        "received_quantity"
                                ),
                                resultSet.getBigDecimal(
                                        "fulfillment_rate"
                                ),
                                resultSet.getBoolean(
                                        "late"
                                )
                        ),
                from,
                to
        );
    }

    private BigDecimal decimal(
            BigDecimal value
    ) {
        return value == null
                ? BigDecimal.ZERO
                : value;
    }

    private long number(
            Long value
    ) {
        return value == null
                ? 0
                : value;
    }

    public record ValueRow(
            String label,
            BigDecimal amount,
            long count
    ) {
    }
}
