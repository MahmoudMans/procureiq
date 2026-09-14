package com.procureiq.rfq;

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
@Table(name = "rfq_line_items")
public class RfqLineItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "rfq_id",
            nullable = false
    )
    private RfqEntity rfq;

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

    public UUID getId() {
        return id;
    }

    public RfqEntity getRfq() {
        return rfq;
    }

    public void setRfq(
            RfqEntity rfq
    ) {
        this.rfq = rfq;
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
}
