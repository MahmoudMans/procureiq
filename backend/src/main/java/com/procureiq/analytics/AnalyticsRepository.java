package com.procureiq.analytics;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public class AnalyticsRepository {

    private static final String COMMITTED_PO_STATUSES =
            "'ISSUED','PARTIALLY_RECEIVED','RECEIVED'";

    private final JdbcTemplate jdbcTemplate;

    public AnalyticsRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public BigDecimal committedSpend() {
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
                        """,
                        BigDecimal.class
                )
        );
    }

    public long committedOrderCount() {
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
                        """,
                        Long.class
                )
        );
    }

    public long activeSupplierCount() {
        return number(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM suppliers
                        WHERE active = TRUE
                        """,
                        Long.class
                )
        );
    }

    public BigDecimal sourcingSavings() {
        return decimal(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            SUM(
                                GREATEST(
                                    quotation_max.maximum_total
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
                        ) quotation_max
                            ON quotation_max.rfq_id =
                               award.rfq_id
                        """,
                        BigDecimal.class
                )
        );
    }

    public BigDecimal averageProcurementCycleDays() {
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
                            ON rfq.id = award.rfq_id
                        JOIN purchase_requests request
                            ON request.id =
                               rfq.source_purchase_request_id
                        WHERE request.submitted_at
                              IS NOT NULL
                        """,
                        BigDecimal.class
                )
        );
    }

    public long openDeliveryOrders() {
        return number(
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM purchase_orders
                        WHERE status IN (
                            'ISSUED',
                            'PARTIALLY_RECEIVED'
                        )
                        """,
                        Long.class
                )
        );
    }

    public long overdueDeliveryOrders() {
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
                        """,
                        Long.class
                )
        );
    }

    public List<MonthRow> monthlySpend() {
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
                    COUNT(*) AS order_count
                FROM purchase_orders
                WHERE status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )
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
                        new MonthRow(
                                resultSet.getString(
                                        "month_key"
                                ),
                                resultSet.getBigDecimal(
                                        "amount"
                                ),
                                resultSet.getLong(
                                        "order_count"
                                )
                        )
        );
    }

    public List<ValueRow> spendBySupplier() {
        return jdbcTemplate.query(
                """
                SELECT
                    supplier.legal_name
                        AS label,
                    COALESCE(
                        SUM(purchase_order.total_amount),
                        0
                    ) AS value,
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
                GROUP BY
                    supplier.id,
                    supplier.legal_name
                ORDER BY
                    value DESC
                LIMIT 8
                """,
                this::mapValueRow
        );
    }

    public List<ValueRow> spendByCategory() {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order_line.category
                        AS label,
                    COALESCE(
                        SUM(
                            purchase_order_line.line_total
                        ),
                        0
                    ) AS value,
                    COUNT(*)
                        AS item_count
                FROM purchase_order_lines
                    purchase_order_line
                JOIN purchase_orders
                    purchase_order
                    ON purchase_order.id =
                       purchase_order_line.purchase_order_id
                WHERE purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )
                GROUP BY
                    purchase_order_line.category
                ORDER BY
                    value DESC
                LIMIT 10
                """,
                this::mapValueRow
        );
    }

    public List<ValueRow> spendByDepartment() {
        return jdbcTemplate.query(
                """
                SELECT
                    department.name
                        AS label,
                    COALESCE(
                        SUM(purchase_order.total_amount),
                        0
                    ) AS value,
                    COUNT(*)
                        AS item_count
                FROM purchase_orders purchase_order
                JOIN rfqs rfq
                    ON rfq.id =
                       purchase_order.rfq_id
                JOIN purchase_requests request
                    ON request.id =
                       rfq.source_purchase_request_id
                JOIN departments department
                    ON department.id =
                       request.department_id
                WHERE purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )
                GROUP BY
                    department.id,
                    department.name
                ORDER BY
                    value DESC
                """,
                this::mapValueRow
        );
    }

    public List<ValueRow> riskExposure() {
        return jdbcTemplate.query(
                """
                SELECT
                    COALESCE(
                        supplier.risk_level,
                        'UNKNOWN'
                    ) AS label,
                    COALESCE(
                        SUM(purchase_order.total_amount),
                        0
                    ) AS value,
                    COUNT(
                        DISTINCT supplier.id
                    ) AS item_count
                FROM purchase_orders purchase_order
                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id
                WHERE purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )
                GROUP BY
                    supplier.risk_level
                ORDER BY
                    value DESC
                """,
                this::mapValueRow
        );
    }

    public List<ValueRow> purchaseOrderPipeline() {
        return jdbcTemplate.query(
                """
                SELECT
                    status AS label,
                    COALESCE(
                        SUM(total_amount),
                        0
                    ) AS value,
                    COUNT(*)
                        AS item_count
                FROM purchase_orders
                GROUP BY status
                ORDER BY
                    item_count DESC,
                    status
                """,
                this::mapValueRow
        );
    }

    private ValueRow mapValueRow(
            java.sql.ResultSet resultSet,
            int rowNumber
    ) throws java.sql.SQLException {
        return new ValueRow(
                resultSet.getString(
                        "label"
                ),
                resultSet.getBigDecimal(
                        "value"
                ),
                resultSet.getLong(
                        "item_count"
                )
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
            BigDecimal value,
            long count
    ) {
    }

    public record MonthRow(
            String month,
            BigDecimal amount,
            long orderCount
    ) {
    }
}
