package com.procureiq.quotation;

import com.procureiq.rfq.RfqLineItemEntity;
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
@Table(name = "quotation_lines")
public class QuotationLineEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "quotation_id",
            nullable = false
    )
    private QuotationEntity quotation;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "rfq_line_item_id",
            nullable = false
    )
    private RfqLineItemEntity rfqLineItem;

    @Column(
            name = "line_number",
            nullable = false
    )
    private int lineNumber;

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
            name = "line_subtotal",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal lineSubtotal;

    public UUID getId() {
        return id;
    }

    public QuotationEntity getQuotation() {
        return quotation;
    }

    public void setQuotation(
            QuotationEntity quotation
    ) {
        this.quotation = quotation;
    }

    public RfqLineItemEntity getRfqLineItem() {
        return rfqLineItem;
    }

    public void setRfqLineItem(
            RfqLineItemEntity rfqLineItem
    ) {
        this.rfqLineItem = rfqLineItem;
    }

    public int getLineNumber() {
        return lineNumber;
    }

    public void setLineNumber(
            int lineNumber
    ) {
        this.lineNumber = lineNumber;
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

    public BigDecimal getLineSubtotal() {
        return lineSubtotal;
    }

    public void setLineSubtotal(
            BigDecimal lineSubtotal
    ) {
        this.lineSubtotal = lineSubtotal;
    }
}
