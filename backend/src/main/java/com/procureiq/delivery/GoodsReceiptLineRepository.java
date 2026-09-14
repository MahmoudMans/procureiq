package com.procureiq.delivery;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.UUID;

public interface GoodsReceiptLineRepository
        extends JpaRepository<GoodsReceiptLineEntity, UUID> {

    @Query("""
            select coalesce(
                sum(line.quantityReceived),
                0
            )
            from GoodsReceiptLineEntity line
            where line.purchaseOrderLine.id = :lineId
            """)
    BigDecimal totalReceivedForPurchaseOrderLine(
            @Param("lineId")
            UUID lineId
    );
}
