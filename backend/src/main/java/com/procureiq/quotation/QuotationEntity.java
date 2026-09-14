package com.procureiq.quotation;

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
@Table(name = "quotations")
public class QuotationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(
            name = "quotation_number",
            nullable = false,
            unique = true,
            length = 40
    )
    private String quotationNumber;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "rfq_id",
            nullable = false
    )
    private RfqEntity rfq;

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
            name = "lead_time_days",
            nullable = false
    )
    private int leadTimeDays;

    @Column(
            name = "payment_terms",
            nullable = false,
            length = 300
    )
    private String paymentTerms;

    @Column(
            name = "validity_date",
            nullable = false
    )
    private LocalDate validityDate;

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
    private QuotationStatus status;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "recorded_by_user_id",
            nullable = false
    )
    private AppUserEntity recordedBy;

    @Column(
            name = "submitted_at"
    )
    private Instant submittedAt;

    @Column(
            name = "withdrawn_at"
    )
    private Instant withdrawnAt;

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
            mappedBy = "quotation",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("lineNumber ASC")
    private List<QuotationLineEntity> lines =
            new ArrayList<>();

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (status == null) {
            status = QuotationStatus.DRAFT;
        }

        if (subtotal == null) {
            subtotal = BigDecimal.ZERO;
        }

        if (discountAmount == null) {
            discountAmount = BigDecimal.ZERO;
        }

        if (shippingAmount == null) {
            shippingAmount = BigDecimal.ZERO;
        }

        if (taxAmount == null) {
            taxAmount = BigDecimal.ZERO;
        }

        if (totalAmount == null) {
            totalAmount = BigDecimal.ZERO;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public void replaceLines(
            List<QuotationLineEntity> newLines
    ) {
        lines.clear();

        for (
                QuotationLineEntity line
                : newLines
        ) {
            line.setQuotation(this);
            lines.add(line);
        }
    }

    public UUID getId() {
        return id;
    }

    public String getQuotationNumber() {
        return quotationNumber;
    }

    public void setQuotationNumber(
            String quotationNumber
    ) {
        this.quotationNumber =
                quotationNumber;
    }

    public RfqEntity getRfq() {
        return rfq;
    }

    public void setRfq(
            RfqEntity rfq
    ) {
        this.rfq = rfq;
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

    public int getLeadTimeDays() {
        return leadTimeDays;
    }

    public void setLeadTimeDays(
            int leadTimeDays
    ) {
        this.leadTimeDays =
                leadTimeDays;
    }

    public String getPaymentTerms() {
        return paymentTerms;
    }

    public void setPaymentTerms(
            String paymentTerms
    ) {
        this.paymentTerms =
                paymentTerms;
    }

    public LocalDate getValidityDate() {
        return validityDate;
    }

    public void setValidityDate(
            LocalDate validityDate
    ) {
        this.validityDate =
                validityDate;
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
        this.discountAmount =
                discountAmount;
    }

    public BigDecimal getShippingAmount() {
        return shippingAmount;
    }

    public void setShippingAmount(
            BigDecimal shippingAmount
    ) {
        this.shippingAmount =
                shippingAmount;
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
        this.totalAmount =
                totalAmount;
    }

    public QuotationStatus getStatus() {
        return status;
    }

    public void setStatus(
            QuotationStatus status
    ) {
        this.status = status;
    }

    public AppUserEntity getRecordedBy() {
        return recordedBy;
    }

    public void setRecordedBy(
            AppUserEntity recordedBy
    ) {
        this.recordedBy =
                recordedBy;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(
            Instant submittedAt
    ) {
        this.submittedAt =
                submittedAt;
    }

    public Instant getWithdrawnAt() {
        return withdrawnAt;
    }

    public void setWithdrawnAt(
            Instant withdrawnAt
    ) {
        this.withdrawnAt =
                withdrawnAt;
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

    public List<QuotationLineEntity> getLines() {
        return lines;
    }
}
