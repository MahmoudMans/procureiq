package com.procureiq.supplierportal;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Reads and answers the purchase orders issued to one supplier.
 *
 * Every query is restricted to the supplier of the signed-in portal session and to orders that
 * were actually issued: a draft, or a draft cancelled before it was issued, is never visible to
 * the supplier.
 */
@Repository
public class SupplierPortalPurchaseOrderRepository {

    private final JdbcTemplate jdbcTemplate;

    public SupplierPortalPurchaseOrderRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public List<OrderRow> findIssuedForSupplier(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                orderSql()
                        + """
                        ORDER BY
                            po.issued_at DESC,
                            po.po_number
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapOrder(
                                resultSet
                        ),
                supplierId
        );
    }

    public OrderRow findIssuedForSupplier(
            UUID supplierId,
            UUID purchaseOrderId
    ) {
        return jdbcTemplate.query(
                orderSql()
                        + """
                        AND po.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapOrder(
                                resultSet
                        ),
                supplierId,
                purchaseOrderId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<LineRow> lines(
            UUID purchaseOrderId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    pol.line_number,
                    pol.item_name,
                    pol.description,
                    pol.category,
                    pol.quantity,
                    pol.unit,
                    pol.unit_price,
                    pol.line_total
                FROM purchase_order_lines pol
                WHERE pol.purchase_order_id = ?
                ORDER BY pol.line_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new LineRow(
                                resultSet.getInt(
                                        "line_number"
                                ),
                                resultSet.getString(
                                        "item_name"
                                ),
                                resultSet.getString(
                                        "description"
                                ),
                                resultSet.getString(
                                        "category"
                                ),
                                resultSet.getBigDecimal(
                                        "quantity"
                                ),
                                resultSet.getString(
                                        "unit"
                                ),
                                resultSet.getBigDecimal(
                                        "unit_price"
                                ),
                                resultSet.getBigDecimal(
                                        "line_total"
                                )
                        ),
                purchaseOrderId
        );
    }

    /**
     * Records the supplier's answer. Only an issued order that has not been answered yet can be
     * answered, and only by its own supplier; the condition lives in the statement so two
     * concurrent answers cannot both win. Returns the number of rows changed (0 or 1).
     */
    public int respond(
            UUID purchaseOrderId,
            UUID supplierId,
            UUID accountId,
            String response,
            String note
    ) {
        return jdbcTemplate.update(
                """
                UPDATE purchase_orders
                SET supplier_response = ?,
                    supplier_responded_at = CURRENT_TIMESTAMP,
                    supplier_response_note = ?,
                    supplier_responded_by_account_id = ?,
                    updated_at = CURRENT_TIMESTAMP,
                    version = version + 1
                WHERE id = ?
                AND supplier_id = ?
                AND status = 'ISSUED'
                AND supplier_response = 'PENDING'
                """,
                response,
                note,
                accountId,
                purchaseOrderId,
                supplierId
        );
    }

    private String orderSql() {
        return """
                SELECT
                    po.id,
                    po.po_number,
                    po.rfq_id,
                    rfq.rfq_number,
                    quotation.quotation_number,
                    COALESCE(
                        po.issued_by_user_id,
                        po.created_by_user_id
                    ) AS owner_user_id,
                    po.currency,
                    po.payment_terms,
                    po.expected_delivery_date,
                    po.delivery_address,
                    po.subtotal,
                    po.discount_amount,
                    po.shipping_amount,
                    po.tax_amount,
                    po.total_amount,
                    po.status,
                    po.supplier_response,
                    po.supplier_responded_at,
                    po.supplier_response_note,
                    po.issued_at,
                    po.cancelled_at
                FROM purchase_orders po
                JOIN rfqs rfq
                    ON rfq.id = po.rfq_id
                JOIN quotations quotation
                    ON quotation.id = po.quotation_id
                WHERE po.supplier_id = ?
                AND po.issued_at IS NOT NULL
                """;
    }

    private OrderRow mapOrder(
            ResultSet resultSet
    ) throws SQLException {
        return new OrderRow(
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
                resultSet.getString(
                        "rfq_number"
                ),
                resultSet.getString(
                        "quotation_number"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getString(
                        "payment_terms"
                ),
                resultSet.getObject(
                        "expected_delivery_date",
                        LocalDate.class
                ),
                resultSet.getString(
                        "delivery_address"
                ),
                resultSet.getBigDecimal(
                        "subtotal"
                ),
                resultSet.getBigDecimal(
                        "discount_amount"
                ),
                resultSet.getBigDecimal(
                        "shipping_amount"
                ),
                resultSet.getBigDecimal(
                        "tax_amount"
                ),
                resultSet.getBigDecimal(
                        "total_amount"
                ),
                resultSet.getString(
                        "status"
                ),
                resultSet.getString(
                        "supplier_response"
                ),
                instant(
                        resultSet,
                        "supplier_responded_at"
                ),
                resultSet.getString(
                        "supplier_response_note"
                ),
                instant(
                        resultSet,
                        "issued_at"
                ),
                instant(
                        resultSet,
                        "cancelled_at"
                )
        );
    }

    private static Instant instant(
            ResultSet resultSet,
            String column
    ) throws SQLException {
        Timestamp timestamp =
                resultSet.getTimestamp(
                        column
                );

        return timestamp == null
                ? null
                : timestamp.toInstant();
    }

    public record OrderRow(
            UUID id,
            String poNumber,
            UUID rfqId,
            String rfqNumber,
            String quotationNumber,
            UUID ownerUserId,
            String currency,
            String paymentTerms,
            LocalDate expectedDeliveryDate,
            String deliveryAddress,
            BigDecimal subtotal,
            BigDecimal discountAmount,
            BigDecimal shippingAmount,
            BigDecimal taxAmount,
            BigDecimal totalAmount,
            String status,
            String supplierResponse,
            Instant supplierRespondedAt,
            String supplierResponseNote,
            Instant issuedAt,
            Instant cancelledAt
    ) {
    }

    public record LineRow(
            int lineNumber,
            String itemName,
            String description,
            String category,
            BigDecimal quantity,
            String unit,
            BigDecimal unitPrice,
            BigDecimal lineTotal
    ) {
    }
}
