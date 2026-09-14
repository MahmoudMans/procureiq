package com.procureiq.purchaserequest;

import com.procureiq.organization.DepartmentEntity;
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
@Table(name = "purchase_requests")
public class PurchaseRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(
            name = "request_number",
            nullable = false,
            unique = true,
            length = 40
    )
    private String requestNumber;

    @Column(
            name = "title",
            nullable = false,
            length = 200
    )
    private String title;

    @Column(
            name = "description",
            length = 2000
    )
    private String description;

    @Column(
            name = "business_justification",
            nullable = false,
            length = 3000
    )
    private String businessJustification;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "requester_id",
            nullable = false
    )
    private AppUserEntity requester;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "department_id",
            nullable = false
    )
    private DepartmentEntity department;

    @Column(
            name = "cost_center",
            nullable = false,
            length = 80
    )
    private String costCenter;

    @Column(
            name = "currency",
            nullable = false,
            length = 3
    )
    private String currency;

    @Column(
            name = "desired_delivery_date",
            nullable = false
    )
    private LocalDate desiredDeliveryDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 30
    )
    private PurchaseRequestStatus status;

    @Column(
            name = "estimated_total_amount",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal estimatedTotalAmount;

    @Column(
            name = "submitted_at"
    )
    private Instant submittedAt;

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
            mappedBy = "purchaseRequest",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("lineNumber ASC")
    private List<PurchaseRequestItemEntity> items =
            new ArrayList<>();

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (status == null) {
            status = PurchaseRequestStatus.DRAFT;
        }

        if (estimatedTotalAmount == null) {
            estimatedTotalAmount =
                    BigDecimal.ZERO;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public void replaceItems(
            List<PurchaseRequestItemEntity> newItems
    ) {
        items.clear();

        for (
                PurchaseRequestItemEntity item
                : newItems
        ) {
            item.setPurchaseRequest(this);
            items.add(item);
        }
    }

    public UUID getId() {
        return id;
    }

    public String getRequestNumber() {
        return requestNumber;
    }

    public void setRequestNumber(
            String requestNumber
    ) {
        this.requestNumber = requestNumber;
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
        this.description = description;
    }

    public String getBusinessJustification() {
        return businessJustification;
    }

    public void setBusinessJustification(
            String businessJustification
    ) {
        this.businessJustification =
                businessJustification;
    }

    public AppUserEntity getRequester() {
        return requester;
    }

    public void setRequester(
            AppUserEntity requester
    ) {
        this.requester = requester;
    }

    public DepartmentEntity getDepartment() {
        return department;
    }

    public void setDepartment(
            DepartmentEntity department
    ) {
        this.department = department;
    }

    public String getCostCenter() {
        return costCenter;
    }

    public void setCostCenter(
            String costCenter
    ) {
        this.costCenter = costCenter;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(
            String currency
    ) {
        this.currency = currency;
    }

    public LocalDate getDesiredDeliveryDate() {
        return desiredDeliveryDate;
    }

    public void setDesiredDeliveryDate(
            LocalDate desiredDeliveryDate
    ) {
        this.desiredDeliveryDate =
                desiredDeliveryDate;
    }

    public PurchaseRequestStatus getStatus() {
        return status;
    }

    public void setStatus(
            PurchaseRequestStatus status
    ) {
        this.status = status;
    }

    public BigDecimal getEstimatedTotalAmount() {
        return estimatedTotalAmount;
    }

    public void setEstimatedTotalAmount(
            BigDecimal estimatedTotalAmount
    ) {
        this.estimatedTotalAmount =
                estimatedTotalAmount;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(
            Instant submittedAt
    ) {
        this.submittedAt = submittedAt;
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

    public List<PurchaseRequestItemEntity> getItems() {
        return items;
    }
}
