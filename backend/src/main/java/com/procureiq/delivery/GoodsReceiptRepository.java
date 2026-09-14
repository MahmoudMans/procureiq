package com.procureiq.delivery;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface GoodsReceiptRepository
        extends JpaRepository<GoodsReceiptEntity, UUID> {

    @Query(
            value = """
                    SELECT nextval('goods_receipt_number_seq')
                    """,
            nativeQuery = true
    )
    Long nextReceiptSequence();

    List<GoodsReceiptEntity>
    findAllByPurchaseOrder_IdOrderByReceivedDateDescCreatedAtDesc(
            UUID purchaseOrderId
    );
}
