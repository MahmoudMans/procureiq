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
                        like lower(concat('%', :query, '%'))
                    or lower(
                        purchaseOrder.supplier.legalName
                    )
                        like lower(concat('%', :query, '%'))
                    or lower(
                        purchaseOrder.rfq.rfqNumber
                    )
                        like lower(concat('%', :query, '%'))
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
}
