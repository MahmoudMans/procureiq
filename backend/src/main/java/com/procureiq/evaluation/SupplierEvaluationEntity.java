package com.procureiq.evaluation;

import com.procureiq.quotation.QuotationEntity;
import com.procureiq.rfq.RfqEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "supplier_evaluations")
public class SupplierEvaluationEntity {

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

    @OneToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "quotation_id",
            nullable = false,
            unique = true
    )
    private QuotationEntity quotation;

    @Column(
            name = "price_score",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal priceScore;

    @Column(
            name = "delivery_score",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal deliveryScore;

    @Column(
            name = "supplier_rating_score",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal supplierRatingScore;

    @Column(
            name = "risk_score",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal riskScore;

    @Column(
            name = "quality_score",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal qualityScore;

    @Column(
            name = "weighted_total_score",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal weightedTotalScore;

    @Column(
            name = "rank_position",
            nullable = false
    )
    private int rankPosition;

    @Column(
            name = "recommended",
            nullable = false
    )
    private boolean recommended;

    @Column(
            name = "calculated_at",
            nullable = false,
            updatable = false
    )
    private Instant calculatedAt;

    @PrePersist
    void prePersist() {
        if (calculatedAt == null) {
            calculatedAt = Instant.now();
        }
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

    public QuotationEntity getQuotation() {
        return quotation;
    }

    public void setQuotation(
            QuotationEntity quotation
    ) {
        this.quotation = quotation;
    }

    public BigDecimal getPriceScore() {
        return priceScore;
    }

    public void setPriceScore(
            BigDecimal priceScore
    ) {
        this.priceScore = priceScore;
    }

    public BigDecimal getDeliveryScore() {
        return deliveryScore;
    }

    public void setDeliveryScore(
            BigDecimal deliveryScore
    ) {
        this.deliveryScore = deliveryScore;
    }

    public BigDecimal getSupplierRatingScore() {
        return supplierRatingScore;
    }

    public void setSupplierRatingScore(
            BigDecimal supplierRatingScore
    ) {
        this.supplierRatingScore =
                supplierRatingScore;
    }

    public BigDecimal getRiskScore() {
        return riskScore;
    }

    public void setRiskScore(
            BigDecimal riskScore
    ) {
        this.riskScore = riskScore;
    }

    public BigDecimal getQualityScore() {
        return qualityScore;
    }

    public void setQualityScore(
            BigDecimal qualityScore
    ) {
        this.qualityScore = qualityScore;
    }

    public BigDecimal getWeightedTotalScore() {
        return weightedTotalScore;
    }

    public void setWeightedTotalScore(
            BigDecimal weightedTotalScore
    ) {
        this.weightedTotalScore =
                weightedTotalScore;
    }

    public int getRankPosition() {
        return rankPosition;
    }

    public void setRankPosition(
            int rankPosition
    ) {
        this.rankPosition = rankPosition;
    }

    public boolean isRecommended() {
        return recommended;
    }

    public void setRecommended(
            boolean recommended
    ) {
        this.recommended = recommended;
    }

    public Instant getCalculatedAt() {
        return calculatedAt;
    }
}
