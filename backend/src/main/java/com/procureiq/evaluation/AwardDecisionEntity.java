package com.procureiq.evaluation;

import com.procureiq.quotation.QuotationEntity;
import com.procureiq.rfq.RfqEntity;
import com.procureiq.user.AppUserEntity;
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

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "award_decisions")
public class AwardDecisionEntity {

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

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "selected_quotation_id",
            nullable = false
    )
    private QuotationEntity selectedQuotation;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "recommended_quotation_id",
            nullable = false
    )
    private QuotationEntity recommendedQuotation;

    @Column(
            name = "manual_override",
            nullable = false
    )
    private boolean manualOverride;

    @Column(
            name = "rationale",
            nullable = false,
            length = 3000
    )
    private String rationale;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "decided_by_user_id",
            nullable = false
    )
    private AppUserEntity decidedBy;

    @Column(
            name = "decided_at",
            nullable = false
    )
    private Instant decidedAt;

    @PrePersist
    void prePersist() {
        if (decidedAt == null) {
            decidedAt = Instant.now();
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

    public QuotationEntity getSelectedQuotation() {
        return selectedQuotation;
    }

    public void setSelectedQuotation(
            QuotationEntity selectedQuotation
    ) {
        this.selectedQuotation =
                selectedQuotation;
    }

    public QuotationEntity getRecommendedQuotation() {
        return recommendedQuotation;
    }

    public void setRecommendedQuotation(
            QuotationEntity recommendedQuotation
    ) {
        this.recommendedQuotation =
                recommendedQuotation;
    }

    public boolean isManualOverride() {
        return manualOverride;
    }

    public void setManualOverride(
            boolean manualOverride
    ) {
        this.manualOverride = manualOverride;
    }

    public String getRationale() {
        return rationale;
    }

    public void setRationale(
            String rationale
    ) {
        this.rationale = rationale;
    }

    public AppUserEntity getDecidedBy() {
        return decidedBy;
    }

    public void setDecidedBy(
            AppUserEntity decidedBy
    ) {
        this.decidedBy = decidedBy;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }
}
