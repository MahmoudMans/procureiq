package com.procureiq.purchaseorder;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PurchaseOrderRepository
        extends JpaRepository<PurchaseOrderEntity, UUID> {

    @Query(
            value = """
                    SELECT nextval('purchase_order_number_seq')
                    """,
            nativeQuery = true
    )
    Long nextPurchaseOrderSequence();

    boolean existsByRfq_Id(
            UUID rfqId
    );

    List<PurchaseOrderEntity>
    findAllBySupplier_Id(
            UUID supplierId
    );

    @Query("""
            select purchaseOrder
            from PurchaseOrderEntity purchaseOrder
            where (
                    :query is null
                    or lower(purchaseOrder.poNumber)
                        like lower(concat('%', cast(:query as string), '%'))
                    or lower(
                        purchaseOrder.supplier.legalName
                    )
                        like lower(concat('%', cast(:query as string), '%'))
                    or lower(
                        purchaseOrder.rfq.rfqNumber
                    )
                        like lower(concat('%', cast(:query as string), '%'))
            )
            and (
                    :status is null
                    or purchaseOrder.status = :status
            )
            order by purchaseOrder.updatedAt desc
            """)
    List<PurchaseOrderEntity> search(
            @Param("query")
            String query,

            @Param("status")
            PurchaseOrderStatus status
    );

    /**
     * Reopens a rejected, issued order as a draft. The conditions are part of the statement, so
     * it changes nothing (returns 0) if the order is not issued and rejected, or if any goods
     * receipt exists. Returns the number of rows changed (0 or 1).
     */
    @org.springframework.data.jpa.repository.Modifying(
            flushAutomatically = true,
            clearAutomatically = true
    )
    @Query(
            value = """
                    UPDATE purchase_orders
                    SET status = 'DRAFT',
                        issued_by_user_id = NULL,
                        issued_at = NULL,
                        supplier_response = 'PENDING',
                        supplier_responded_at = NULL,
                        supplier_response_note = NULL,
                        supplier_responded_by_account_id = NULL,
                        updated_at = CURRENT_TIMESTAMP,
                        version = version + 1
                    WHERE id = :purchaseOrderId
                    AND status = 'ISSUED'
                    AND supplier_response = 'REJECTED'
                    AND NOT EXISTS (
                        SELECT 1
                        FROM goods_receipts receipt
                        WHERE receipt.purchase_order_id = purchase_orders.id
                    )
                    """,
            nativeQuery = true
    )
    int reopenRejected(
            @Param("purchaseOrderId")
            UUID purchaseOrderId
    );
}
