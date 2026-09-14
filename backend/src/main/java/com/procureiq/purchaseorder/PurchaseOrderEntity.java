package com.procureiq.purchaseorder;

import com.procureiq.evaluation.AwardDecisionEntity;
import com.procureiq.quotation.QuotationEntity;
import com.procureiq.rfq.RfqEntity;
import com.procureiq.supplier.SupplierEntity;
import com.procureiq.user.AppUserEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "purchase_orders")
public class PurchaseOrderEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(
            name = "po_number",
            nullable = false,
            unique = true,
            length = 40
    )
    private String poNumber;

    @OneToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "rfq_id",
            nullable = false,
            unique = true
    )
    private RfqEntity rfq;

    @OneToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "award_decision_id",
            nullable = false,
            unique = true
    )
    private AwardDecisionEntity awardDecision;

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
            name = "supplier_id",
            nullable = false
    )
    private SupplierEntity supplier;

    @Column(
            name = "currency",
            nullable = false,
            length = 3
    )
    private String currency;

    @Column(
            name = "payment_terms",
            nullable = false,
            length = 300
    )
    private String paymentTerms;

    @Column(
            name = "expected_delivery_date",
            nullable = false
    )
    private LocalDate expectedDeliveryDate;

    @Column(
            name = "delivery_address",
            nullable = false,
            length = 1000
    )
    private String deliveryAddress;

    @Column(
            name = "buyer_notes",
            length = 2000
    )
    private String buyerNotes;

    @Column(
            name = "subtotal",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal subtotal;

    @Column(
            name = "discount_amount",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal discountAmount;

    @Column(
            name = "shipping_amount",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal shippingAmount;

    @Column(
            name = "tax_amount",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal taxAmount;

    @Column(
            name = "total_amount",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 30
    )
    private PurchaseOrderStatus status;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "created_by_user_id",
            nullable = false
    )
    private AppUserEntity createdBy;

    @ManyToOne(
            fetch = FetchType.LAZY
    )
    @JoinColumn(
            name = "issued_by_user_id"
    )
    private AppUserEntity issuedBy;

    @Column(
            name = "issued_at"
    )
    private Instant issuedAt;

    @Column(
            name = "cancelled_at"
    )
    private Instant cancelledAt;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private Instant createdAt;

    @Column(
            name = "updated_at",
            nullable = false
    )
    private Instant updatedAt;

    @Version
    @Column(
            name = "version",
            nullable = false
    )
    private long version;

    @OneToMany(
            mappedBy = "purchaseOrder",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("lineNumber ASC")
    private List<PurchaseOrderLineEntity> lines =
            new ArrayList<>();

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (status == null) {
            status = PurchaseOrderStatus.DRAFT;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public void replaceLines(
            List<PurchaseOrderLineEntity> newLines
    ) {
        lines.clear();

        for (
                PurchaseOrderLineEntity line
                : newLines
        ) {
            line.setPurchaseOrder(this);
            lines.add(line);
        }
    }

    public UUID getId() {
        return id;
    }

    public String getPoNumber() {
        return poNumber;
    }

    public void setPoNumber(
            String poNumber
    ) {
        this.poNumber = poNumber;
    }

    public RfqEntity getRfq() {
        return rfq;
    }

    public void setRfq(
            RfqEntity rfq
    ) {
        this.rfq = rfq;
    }

    public AwardDecisionEntity getAwardDecision() {
        return awardDecision;
    }

    public void setAwardDecision(
            AwardDecisionEntity awardDecision
    ) {
        this.awardDecision = awardDecision;
    }

    public QuotationEntity getQuotation() {
        return quotation;
    }

    public void setQuotation(
            QuotationEntity quotation
    ) {
        this.quotation = quotation;
    }

    public SupplierEntity getSupplier() {
        return supplier;
    }

    public void setSupplier(
            SupplierEntity supplier
    ) {
        this.supplier = supplier;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(
            String currency
    ) {
        this.currency = currency;
    }

    public String getPaymentTerms() {
        return paymentTerms;
    }

    public void setPaymentTerms(
            String paymentTerms
    ) {
        this.paymentTerms = paymentTerms;
    }

    public LocalDate getExpectedDeliveryDate() {
        return expectedDeliveryDate;
    }

    public void setExpectedDeliveryDate(
            LocalDate expectedDeliveryDate
    ) {
        this.expectedDeliveryDate =
                expectedDeliveryDate;
    }

    public String getDeliveryAddress() {
        return deliveryAddress;
    }

    public void setDeliveryAddress(
            String deliveryAddress
    ) {
        this.deliveryAddress = deliveryAddress;
    }

    public String getBuyerNotes() {
        return buyerNotes;
    }

    public void setBuyerNotes(
            String buyerNotes
    ) {
        this.buyerNotes = buyerNotes;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(
            BigDecimal subtotal
    ) {
        this.subtotal = subtotal;
    }

    public BigDecimal getDiscountAmount() {
        return discountAmount;
    }

    public void setDiscountAmount(
            BigDecimal discountAmount
    ) {
        this.discountAmount = discountAmount;
    }

    public BigDecimal getShippingAmount() {
        return shippingAmount;
    }

    public void setShippingAmount(
            BigDecimal shippingAmount
    ) {
        this.shippingAmount = shippingAmount;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public void setTaxAmount(
            BigDecimal taxAmount
    ) {
        this.taxAmount = taxAmount;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(
            BigDecimal totalAmount
    ) {
        this.totalAmount = totalAmount;
    }

    public PurchaseOrderStatus getStatus() {
        return status;
    }

    public void setStatus(
            PurchaseOrderStatus status
    ) {
        this.status = status;
    }

    public AppUserEntity getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(
            AppUserEntity createdBy
    ) {
        this.createdBy = createdBy;
    }

    public AppUserEntity getIssuedBy() {
        return issuedBy;
    }

    public void setIssuedBy(
            AppUserEntity issuedBy
    ) {
        this.issuedBy = issuedBy;
    }

    public Instant getIssuedAt() {
        return issuedAt;
    }

    public void setIssuedAt(
            Instant issuedAt
    ) {
        this.issuedAt = issuedAt;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public void setCancelledAt(
            Instant cancelledAt
    ) {
        this.cancelledAt = cancelledAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public long getVersion() {
        return version;
    }

    public List<PurchaseOrderLineEntity> getLines() {
        return lines;
    }
}
