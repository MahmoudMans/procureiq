package com.procureiq.risk;

import com.procureiq.contract.SupplierContractEntity;
import com.procureiq.purchaseorder.PurchaseOrderEntity;
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

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "procurement_risk_cases")
public class ProcurementRiskCaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(
            name = "risk_number",
            nullable = false,
            unique = true,
            length = 40
    )
    private String riskNumber;

    @Column(
            name = "source_key",
            unique = true,
            length = 255
    )
    private String sourceKey;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "origin",
            nullable = false,
            length = 30
    )
    private RiskOrigin origin;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "category",
            nullable = false,
            length = 40
    )
    private RiskCategory category;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "severity",
            nullable = false,
            length = 30
    )
    private RiskSeverity severity;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 40
    )
    private RiskCaseStatus status;

    @Column(
            name = "title",
            nullable = false,
            length = 220
    )
    private String title;

    @Column(
            name = "description",
            nullable = false,
            length = 3000
    )
    private String description;

    @Column(
            name = "likelihood",
            nullable = false
    )
    private int likelihood;

    @Column(
            name = "impact",
            nullable = false
    )
    private int impact;

    @Column(
            name = "risk_score",
            nullable = false
    )
    private int riskScore;

    @Column(
            name = "due_date"
    )
    private LocalDate dueDate;

    @ManyToOne(
            fetch = FetchType.LAZY
    )
    @JoinColumn(
            name = "supplier_id"
    )
    private SupplierEntity supplier;

    @ManyToOne(
            fetch = FetchType.LAZY
    )
    @JoinColumn(
            name = "contract_id"
    )
    private SupplierContractEntity contract;

    @ManyToOne(
            fetch = FetchType.LAZY
    )
    @JoinColumn(
            name = "purchase_order_id"
    )
    private PurchaseOrderEntity purchaseOrder;

    @ManyToOne(
            fetch = FetchType.LAZY
    )
    @JoinColumn(
            name = "rfq_id"
    )
    private RfqEntity rfq;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "owner_user_id",
            nullable = false
    )
    private AppUserEntity owner;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "created_by_user_id",
            nullable = false
    )
    private AppUserEntity createdBy;

    @Column(
            name = "escalated",
            nullable = false
    )
    private boolean escalated;

    @Column(
            name = "escalated_at"
    )
    private Instant escalatedAt;

    @ManyToOne(
            fetch = FetchType.LAZY
    )
    @JoinColumn(
            name = "escalated_by_user_id"
    )
    private AppUserEntity escalatedBy;

    @Column(
            name = "resolution_note",
            length = 3000
    )
    private String resolutionNote;

    @Column(
            name = "resolved_at"
    )
    private Instant resolvedAt;

    @ManyToOne(
            fetch = FetchType.LAZY
    )
    @JoinColumn(
            name = "resolved_by_user_id"
    )
    private AppUserEntity resolvedBy;

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
            mappedBy = "riskCase",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("createdAt DESC")
    private List<RiskMitigationActionEntity> mitigationActions =
            new ArrayList<>();

    @PrePersist
    void prePersist() {
        Instant now =
                Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (origin == null) {
            origin =
                    RiskOrigin.MANUAL;
        }

        if (status == null) {
            status =
                    RiskCaseStatus.OPEN;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt =
                Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getRiskNumber() {
        return riskNumber;
    }

    public void setRiskNumber(
            String riskNumber
    ) {
        this.riskNumber =
                riskNumber;
    }

    public String getSourceKey() {
        return sourceKey;
    }

    public void setSourceKey(
            String sourceKey
    ) {
        this.sourceKey =
                sourceKey;
    }

    public RiskOrigin getOrigin() {
        return origin;
    }

    public void setOrigin(
            RiskOrigin origin
    ) {
        this.origin = origin;
    }

    public RiskCategory getCategory() {
        return category;
    }

    public void setCategory(
            RiskCategory category
    ) {
        this.category = category;
    }

    public RiskSeverity getSeverity() {
        return severity;
    }

    public void setSeverity(
            RiskSeverity severity
    ) {
        this.severity = severity;
    }

    public RiskCaseStatus getStatus() {
        return status;
    }

    public void setStatus(
            RiskCaseStatus status
    ) {
        this.status = status;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(
            String title
    ) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(
            String description
    ) {
        this.description =
                description;
    }

    public int getLikelihood() {
        return likelihood;
    }

    public void setLikelihood(
            int likelihood
    ) {
        this.likelihood =
                likelihood;
    }

    public int getImpact() {
        return impact;
    }

    public void setImpact(
            int impact
    ) {
        this.impact = impact;
    }

    public int getRiskScore() {
        return riskScore;
    }

    public void setRiskScore(
            int riskScore
    ) {
        this.riskScore =
                riskScore;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(
            LocalDate dueDate
    ) {
        this.dueDate = dueDate;
    }

    public SupplierEntity getSupplier() {
        return supplier;
    }

    public void setSupplier(
            SupplierEntity supplier
    ) {
        this.supplier = supplier;
    }

    public SupplierContractEntity getContract() {
        return contract;
    }

    public void setContract(
            SupplierContractEntity contract
    ) {
        this.contract = contract;
    }

    public PurchaseOrderEntity getPurchaseOrder() {
        return purchaseOrder;
    }

    public void setPurchaseOrder(
            PurchaseOrderEntity purchaseOrder
    ) {
        this.purchaseOrder =
                purchaseOrder;
    }

    public RfqEntity getRfq() {
        return rfq;
    }

    public void setRfq(
            RfqEntity rfq
    ) {
        this.rfq = rfq;
    }

    public AppUserEntity getOwner() {
        return owner;
    }

    public void setOwner(
            AppUserEntity owner
    ) {
        this.owner = owner;
    }

    public AppUserEntity getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(
            AppUserEntity createdBy
    ) {
        this.createdBy =
                createdBy;
    }

    public boolean isEscalated() {
        return escalated;
    }

    public void setEscalated(
            boolean escalated
    ) {
        this.escalated =
                escalated;
    }

    public Instant getEscalatedAt() {
        return escalatedAt;
    }

    public void setEscalatedAt(
            Instant escalatedAt
    ) {
        this.escalatedAt =
                escalatedAt;
    }

    public AppUserEntity getEscalatedBy() {
        return escalatedBy;
    }

    public void setEscalatedBy(
            AppUserEntity escalatedBy
    ) {
        this.escalatedBy =
                escalatedBy;
    }

    public String getResolutionNote() {
        return resolutionNote;
    }

    public void setResolutionNote(
            String resolutionNote
    ) {
        this.resolutionNote =
                resolutionNote;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(
            Instant resolvedAt
    ) {
        this.resolvedAt =
                resolvedAt;
    }

    public AppUserEntity getResolvedBy() {
        return resolvedBy;
    }

    public void setResolvedBy(
            AppUserEntity resolvedBy
    ) {
        this.resolvedBy =
                resolvedBy;
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

    public List<RiskMitigationActionEntity> getMitigationActions() {
        return mitigationActions;
    }
}
