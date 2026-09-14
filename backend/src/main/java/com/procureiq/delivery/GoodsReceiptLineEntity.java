package com.procureiq.delivery;

import com.procureiq.purchaseorder.PurchaseOrderLineEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "goods_receipt_lines")
public class GoodsReceiptLineEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "goods_receipt_id",
            nullable = false
    )
    private GoodsReceiptEntity receipt;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "purchase_order_line_id",
            nullable = false
    )
    private PurchaseOrderLineEntity purchaseOrderLine;

    @Column(
            name = "quantity_received",
            nullable = false,
            precision = 14,
            scale = 3
    )
    private BigDecimal quantityReceived;

    public UUID getId() {
        return id;
    }

    public GoodsReceiptEntity getReceipt() {
        return receipt;
    }

    public void setReceipt(
            GoodsReceiptEntity receipt
    ) {
        this.receipt = receipt;
    }

    public PurchaseOrderLineEntity getPurchaseOrderLine() {
        return purchaseOrderLine;
    }

    public void setPurchaseOrderLine(
            PurchaseOrderLineEntity purchaseOrderLine
    ) {
        this.purchaseOrderLine =
                purchaseOrderLine;
    }

    public BigDecimal getQuantityReceived() {
        return quantityReceived;
    }

    public void setQuantityReceived(
            BigDecimal quantityReceived
    ) {
        this.quantityReceived =
                quantityReceived;
    }
}
