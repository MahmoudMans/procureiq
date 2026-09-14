package com.procureiq.supplierinsight;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public class Supplier360Repository {

    private final JdbcTemplate jdbcTemplate;

    public Supplier360Repository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public BigDecimal committedSpend(
            UUID supplierId
    ) {
        return decimal(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            SUM(total_amount),
                            0
                        )
                        FROM purchase_orders
                        WHERE supplier_id = ?
                        AND status IN (
                            'ISSUED',
                            'PARTIALLY_RECEIVED',
                            'RECEIVED'
                        )
                        """,
                        BigDecimal.class,
                        supplierId
                )
        );
    }

    public long purchaseOrderCount(
            UUID supplierId
    ) {
        return number(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM purchase_orders
                        WHERE supplier_id = ?
                        AND status <> 'CANCELLED'
                        """,
                        Long.class,
                        supplierId
                )
        );
    }

    public long openPurchaseOrderCount(
            UUID supplierId
    ) {
        return number(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM purchase_orders
                        WHERE supplier_id = ?
                        AND status IN (
                            'DRAFT',
                            'ISSUED',
                            'PARTIALLY_RECEIVED'
                        )
                        """,
                        Long.class,
                        supplierId
                )
        );
    }

    public long overduePurchaseOrderCount(
            UUID supplierId
    ) {
        return number(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM purchase_orders
                        WHERE supplier_id = ?
                        AND status IN (
                            'ISSUED',
                            'PARTIALLY_RECEIVED'
                        )
                        AND expected_delivery_date
                            < CURRENT_DATE
                        """,
                        Long.class,
                        supplierId
                )
        );
    }

    public long invitedRfqCount(
            UUID supplierId
    ) {
        return number(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM rfq_supplier_invitations
                        WHERE supplier_id = ?
                        """,
                        Long.class,
                        supplierId
                )
        );
    }

    public long submittedQuotationCount(
            UUID supplierId
    ) {
        return number(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM quotations
                        WHERE supplier_id = ?
                        AND status = 'SUBMITTED'
                        """,
                        Long.class,
                        supplierId
                )
        );
    }

    public long awardCount(
            UUID supplierId
    ) {
        return number(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM award_decisions award
                        JOIN quotations quotation
                            ON quotation.id =
                               award.selected_quotation_id
                        WHERE quotation.supplier_id = ?
                        """,
                        Long.class,
                        supplierId
                )
        );
    }

    public BigDecimal averageAwardValue(
            UUID supplierId
    ) {
        return decimal(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            AVG(
                                quotation.total_amount
                            ),
                            0
                        )
                        FROM award_decisions award
                        JOIN quotations quotation
                            ON quotation.id =
                               award.selected_quotation_id
                        WHERE quotation.supplier_id = ?
                        """,
                        BigDecimal.class,
                        supplierId
                )
        );
    }

    public DeliveryPerformanceRow deliveryPerformance(
            UUID supplierId
    ) {
        List<DeliveryPerformanceRow> rows =
                jdbcTemplate.query(
                        """
                        SELECT
                            tracked_orders,
                            completed_orders,
                            on_time_orders,
                            late_orders,
                            on_time_delivery_rate,
                            fulfillment_rate,
                            last_receipt_date
                        FROM supplier_delivery_performance
                        WHERE supplier_id = ?
                        """,
                        (
                                resultSet,
                                rowNumber
                        ) ->
                                new DeliveryPerformanceRow(
                                        resultSet.getLong(
                                                "tracked_orders"
                                        ),
                                        resultSet.getLong(
                                                "completed_orders"
                                        ),
                                        resultSet.getLong(
                                                "on_time_orders"
                                        ),
                                        resultSet.getLong(
                                                "late_orders"
                                        ),
                                        resultSet.getBigDecimal(
                                                "on_time_delivery_rate"
                                        ),
                                        resultSet.getBigDecimal(
                                                "fulfillment_rate"
                                        ),
                                        resultSet.getObject(
                                                "last_receipt_date",
                                                LocalDate.class
                                        )
                                ),
                        supplierId
                );

        if (rows.isEmpty()) {
            return new DeliveryPerformanceRow(
                    0,
                    0,
                    0,
                    0,
                    BigDecimal.ZERO
                            .setScale(2),
                    BigDecimal.ZERO
                            .setScale(2),
                    null
            );
        }

        return rows.getFirst();
    }

    public List<MonthlySpendRow> monthlySpend(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    TO_CHAR(
                        DATE_TRUNC(
                            'month',
                            COALESCE(
                                issued_at,
                                created_at
                            )
                        ),
                        'YYYY-MM'
                    ) AS month_key,
                    COALESCE(
                        SUM(total_amount),
                        0
                    ) AS amount,
                    COUNT(*)
                        AS order_count
                FROM purchase_orders
                WHERE supplier_id = ?
                AND status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )
                AND COALESCE(
                    issued_at,
                    created_at
                ) >=
                    DATE_TRUNC(
                        'month',
                        CURRENT_DATE
                    )
                    - INTERVAL '11 months'
                GROUP BY
                    DATE_TRUNC(
                        'month',
                        COALESCE(
                            issued_at,
                            created_at
                        )
                    )
                ORDER BY
                    DATE_TRUNC(
                        'month',
                        COALESCE(
                            issued_at,
                            created_at
                        )
                    )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new MonthlySpendRow(
                                resultSet.getString(
                                        "month_key"
                                ),
                                resultSet.getBigDecimal(
                                        "amount"
                                ),
                                resultSet.getLong(
                                        "order_count"
                                )
                        ),
                supplierId
        );
    }

    public List<CategorySpendRow> categorySpend(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order_line.category
                        AS category,
                    COALESCE(
                        SUM(
                            purchase_order_line.line_total
                        ),
                        0
                    ) AS amount,
                    COUNT(*)
                        AS line_count
                FROM purchase_order_lines
                    purchase_order_line
                JOIN purchase_orders
                    purchase_order
                    ON purchase_order.id =
                       purchase_order_line.purchase_order_id
                WHERE purchase_order.supplier_id = ?
                AND purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )
                GROUP BY
                    purchase_order_line.category
                ORDER BY
                    amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CategorySpendRow(
                                resultSet.getString(
                                        "category"
                                ),
                                resultSet.getBigDecimal(
                                        "amount"
                                ),
                                resultSet.getLong(
                                        "line_count"
                                )
                        ),
                supplierId
        );
    }

    public List<PurchaseOrderRow>
    recentPurchaseOrders(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order.id,
                    purchase_order.po_number,
                    rfq.rfq_number,
                    purchase_order.status,
                    purchase_order.total_amount,
                    purchase_order.expected_delivery_date,
                    purchase_order.issued_at,
                    purchase_order.created_at
                FROM purchase_orders purchase_order
                JOIN rfqs rfq
                    ON rfq.id =
                       purchase_order.rfq_id
                WHERE purchase_order.supplier_id = ?
                ORDER BY
                    purchase_order.created_at DESC
                LIMIT 10
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp issued =
                            resultSet.getTimestamp(
                                    "issued_at"
                            );

                    Timestamp created =
                            resultSet.getTimestamp(
                                    "created_at"
                            );

                    return new PurchaseOrderRow(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "po_number"
                            ),
                            resultSet.getString(
                                    "rfq_number"
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
                            issued == null
                                    ? null
                                    : issued.toInstant(),
                            created.toInstant()
                    );
                },
                supplierId
        );
    }

    public List<SourcingRow> recentSourcing(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    rfq.id
                        AS rfq_id,
                    rfq.rfq_number,
                    rfq.title,
                    rfq.status
                        AS rfq_status,
                    invitation.status
                        AS invitation_status,
                    rfq.response_deadline,
                    quotation.quotation_number,
                    quotation.status
                        AS quotation_status,
                    quotation.total_amount,
                    quotation.submitted_at
                FROM rfq_supplier_invitations
                    invitation
                JOIN rfqs rfq
                    ON rfq.id =
                       invitation.rfq_id
                LEFT JOIN quotations quotation
                    ON quotation.rfq_id =
                       rfq.id
                    AND quotation.supplier_id =
                        invitation.supplier_id
                WHERE invitation.supplier_id = ?
                ORDER BY
                    invitation.invited_at DESC
                LIMIT 10
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp submitted =
                            resultSet.getTimestamp(
                                    "submitted_at"
                            );

                    return new SourcingRow(
                            resultSet.getObject(
                                    "rfq_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "rfq_number"
                            ),
                            resultSet.getString(
                                    "title"
                            ),
                            resultSet.getString(
                                    "rfq_status"
                            ),
                            resultSet.getString(
                                    "invitation_status"
                            ),
                            resultSet.getObject(
                                    "response_deadline",
                                    LocalDateTime.class
                            ),
                            resultSet.getString(
                                    "quotation_number"
                            ),
                            resultSet.getString(
                                    "quotation_status"
                            ),
                            resultSet.getBigDecimal(
                                    "total_amount"
                            ),
                            submitted == null
                                    ? null
                                    : submitted.toInstant()
                    );
                },
                supplierId
        );
    }

    public List<AwardRow> recentAwards(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    rfq.id
                        AS rfq_id,
                    rfq.rfq_number,
                    quotation.id
                        AS quotation_id,
                    quotation.quotation_number,
                    quotation.total_amount,
                    award.manual_override,
                    award.decided_at
                FROM award_decisions award
                JOIN rfqs rfq
                    ON rfq.id =
                       award.rfq_id
                JOIN quotations quotation
                    ON quotation.id =
                       award.selected_quotation_id
                WHERE quotation.supplier_id = ?
                ORDER BY
                    award.decided_at DESC
                LIMIT 10
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp decided =
                            resultSet.getTimestamp(
                                    "decided_at"
                            );

                    return new AwardRow(
                            resultSet.getObject(
                                    "rfq_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "rfq_number"
                            ),
                            resultSet.getObject(
                                    "quotation_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "quotation_number"
                            ),
                            resultSet.getBigDecimal(
                                    "total_amount"
                            ),
                            resultSet.getBoolean(
                                    "manual_override"
                            ),
                            decided.toInstant()
                    );
                },
                supplierId
        );
    }

    public List<ActivityRow> recentActivity(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    event_type,
                    title,
                    detail,
                    href,
                    occurred_at
                FROM (
                    SELECT
                        'AWARD_WON'
                            AS event_type,
                        'Sourcing award won'
                            AS title,
                        rfq.rfq_number
                            || ' awarded at '
                            || quotation.total_amount
                            AS detail,
                        '/rfqs/'
                            || rfq.id::text
                            AS href,
                        award.decided_at
                            AS occurred_at
                    FROM award_decisions award
                    JOIN quotations quotation
                        ON quotation.id =
                           award.selected_quotation_id
                    JOIN rfqs rfq
                        ON rfq.id =
                           award.rfq_id
                    WHERE quotation.supplier_id = ?

                    UNION ALL

                    SELECT
                        'PURCHASE_ORDER'
                            AS event_type,
                        'Purchase order created'
                            AS title,
                        purchase_order.po_number
                            || ' · '
                            || purchase_order.status
                            AS detail,
                        '/purchase-orders/'
                            || purchase_order.id::text
                            AS href,
                        purchase_order.created_at
                            AS occurred_at
                    FROM purchase_orders purchase_order
                    WHERE purchase_order.supplier_id = ?

                    UNION ALL

                    SELECT
                        'GOODS_RECEIPT'
                            AS event_type,
                        'Goods receipt recorded'
                            AS title,
                        receipt.receipt_number
                            || ' for '
                            || purchase_order.po_number
                            AS detail,
                        '/purchase-orders/'
                            || purchase_order.id::text
                            AS href,
                        receipt.created_at
                            AS occurred_at
                    FROM goods_receipts receipt
                    JOIN purchase_orders purchase_order
                        ON purchase_order.id =
                           receipt.purchase_order_id
                    WHERE purchase_order.supplier_id = ?

                    UNION ALL

                    SELECT
                        'QUOTATION'
                            AS event_type,
                        CASE
                            WHEN quotation.status =
                                'SUBMITTED'
                            THEN 'Quotation submitted'
                            ELSE 'Quotation recorded'
                        END AS title,
                        quotation.quotation_number
                            || ' · '
                            || quotation.status
                            AS detail,
                        '/rfqs/'
                            || quotation.rfq_id::text
                            AS href,
                        COALESCE(
                            quotation.submitted_at,
                            quotation.created_at
                        ) AS occurred_at
                    FROM quotations quotation
                    WHERE quotation.supplier_id = ?
                ) timeline
                ORDER BY
                    occurred_at DESC
                LIMIT 20
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp occurred =
                            resultSet.getTimestamp(
                                    "occurred_at"
                            );

                    return new ActivityRow(
                            resultSet.getString(
                                    "event_type"
                            ),
                            resultSet.getString(
                                    "title"
                            ),
                            resultSet.getString(
                                    "detail"
                            ),
                            resultSet.getString(
                                    "href"
                            ),
                            occurred.toInstant()
                    );
                },
                supplierId,
                supplierId,
                supplierId,
                supplierId
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

    public record DeliveryPerformanceRow(
            long trackedOrders,
            long completedOrders,
            long onTimeOrders,
            long lateOrders,
            BigDecimal onTimeDeliveryRate,
            BigDecimal fulfillmentRate,
            LocalDate lastReceiptDate
    ) {
    }

    public record MonthlySpendRow(
            String month,
            BigDecimal amount,
            long orderCount
    ) {
    }

    public record CategorySpendRow(
            String category,
            BigDecimal amount,
            long lineCount
    ) {
    }

    public record PurchaseOrderRow(
            UUID id,
            String poNumber,
            String rfqNumber,
            String status,
            BigDecimal totalAmount,
            LocalDate expectedDeliveryDate,
            Instant issuedAt,
            Instant createdAt
    ) {
    }

    public record SourcingRow(
            UUID rfqId,
            String rfqNumber,
            String title,
            String rfqStatus,
            String invitationStatus,
            LocalDateTime responseDeadline,
            String quotationNumber,
            String quotationStatus,
            BigDecimal quotationTotal,
            Instant quotationSubmittedAt
    ) {
    }

    public record AwardRow(
            UUID rfqId,
            String rfqNumber,
            UUID quotationId,
            String quotationNumber,
            BigDecimal awardValue,
            boolean manualOverride,
            Instant decidedAt
    ) {
    }

    public record ActivityRow(
            String eventType,
            String title,
            String detail,
            String href,
            Instant occurredAt
    ) {
    }
}
