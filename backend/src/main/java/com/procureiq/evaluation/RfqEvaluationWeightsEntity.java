package com.procureiq.evaluation;

import com.procureiq.rfq.RfqEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rfq_evaluation_weights")
public class RfqEvaluationWeightsEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

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

    @Column(
            name = "price_weight",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal priceWeight;

    @Column(
            name = "delivery_weight",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal deliveryWeight;

    @Column(
            name = "supplier_rating_weight",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal supplierRatingWeight;

    @Column(
            name = "risk_weight",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal riskWeight;

    @Column(
            name = "quality_weight",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal qualityWeight;

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

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

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

    public BigDecimal getPriceWeight() {
        return priceWeight;
    }

    public void setPriceWeight(
            BigDecimal priceWeight
    ) {
        this.priceWeight = priceWeight;
    }

    public BigDecimal getDeliveryWeight() {
        return deliveryWeight;
    }

    public void setDeliveryWeight(
            BigDecimal deliveryWeight
    ) {
        this.deliveryWeight = deliveryWeight;
    }

    public BigDecimal getSupplierRatingWeight() {
        return supplierRatingWeight;
    }

    public void setSupplierRatingWeight(
            BigDecimal supplierRatingWeight
    ) {
        this.supplierRatingWeight =
                supplierRatingWeight;
    }

    public BigDecimal getRiskWeight() {
        return riskWeight;
    }

    public void setRiskWeight(
            BigDecimal riskWeight
    ) {
        this.riskWeight = riskWeight;
    }

    public BigDecimal getQualityWeight() {
        return qualityWeight;
    }

    public void setQualityWeight(
            BigDecimal qualityWeight
    ) {
        this.qualityWeight = qualityWeight;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
