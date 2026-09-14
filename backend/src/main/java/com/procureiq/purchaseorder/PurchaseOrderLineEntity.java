package com.procureiq.purchaseorder;

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
@Table(name = "purchase_order_lines")
public class PurchaseOrderLineEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "purchase_order_id",
            nullable = false
    )
    private PurchaseOrderEntity purchaseOrder;

    @Column(
            name = "line_number",
            nullable = false
    )
    private int lineNumber;

    @Column(
            name = "item_name",
            nullable = false,
            length = 180
    )
    private String itemName;

    @Column(
            name = "description",
            length = 1000
    )
    private String description;

    @Column(
            name = "category",
            nullable = false,
            length = 120
    )
    private String category;

    @Column(
            name = "quantity",
            nullable = false,
            precision = 14,
            scale = 3
    )
    private BigDecimal quantity;

    @Column(
            name = "unit",
            nullable = false,
            length = 30
    )
    private String unit;

    @Column(
            name = "unit_price",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal unitPrice;

    @Column(
            name = "line_total",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal lineTotal;

    public UUID getId() {
        return id;
    }

    public PurchaseOrderEntity getPurchaseOrder() {
        return purchaseOrder;
    }

    public void setPurchaseOrder(
            PurchaseOrderEntity purchaseOrder
    ) {
        this.purchaseOrder = purchaseOrder;
    }

    public int getLineNumber() {
        return lineNumber;
    }

    public void setLineNumber(
            int lineNumber
    ) {
        this.lineNumber = lineNumber;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(
            String itemName
    ) {
        this.itemName = itemName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(
            String description
    ) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(
            String category
    ) {
        this.category = category;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(
            BigDecimal quantity
    ) {
        this.quantity = quantity;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(
            String unit
    ) {
        this.unit = unit;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(
            BigDecimal unitPrice
    ) {
        this.unitPrice = unitPrice;
    }

    public BigDecimal getLineTotal() {
        return lineTotal;
    }

    public void setLineTotal(
            BigDecimal lineTotal
    ) {
        this.lineTotal = lineTotal;
    }
}
