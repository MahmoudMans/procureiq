package com.procureiq.rfq;

import com.procureiq.purchaserequest.PurchaseRequestEntity;
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

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "rfqs")
public class RfqEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(
            name = "rfq_number",
            nullable = false,
            unique = true,
            length = 40
    )
    private String rfqNumber;

    @OneToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "source_purchase_request_id",
            nullable = false,
            unique = true
    )
    private PurchaseRequestEntity sourcePurchaseRequest;

    @Column(
            name = "title",
            nullable = false,
            length = 200
    )
    private String title;

    @Column(
            name = "description",
            length = 3000
    )
    private String description;

    @Column(
            name = "currency",
            nullable = false,
            length = 3
    )
    private String currency;

    @Column(
            name = "response_deadline",
            nullable = false
    )
    private LocalDateTime responseDeadline;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 30
    )
    private RfqStatus status;

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
            name = "published_at"
    )
    private Instant publishedAt;

    @Column(
            name = "closed_at"
    )
    private Instant closedAt;

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
            mappedBy = "rfq",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("lineNumber ASC")
    private List<RfqLineItemEntity> lineItems =
            new ArrayList<>();

    @OneToMany(
            mappedBy = "rfq",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    private List<RfqSupplierInvitationEntity> invitations =
            new ArrayList<>();

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (status == null) {
            status = RfqStatus.DRAFT;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public void replaceLineItems(
            List<RfqLineItemEntity> items
    ) {
        lineItems.clear();

        for (RfqLineItemEntity item : items) {
            item.setRfq(this);
            lineItems.add(item);
        }
    }

    public void replaceInvitations(
            List<RfqSupplierInvitationEntity> newInvitations
    ) {
        invitations.clear();

        for (
                RfqSupplierInvitationEntity invitation
                : newInvitations
        ) {
            invitation.setRfq(this);
            invitations.add(invitation);
        }
    }

    public UUID getId() {
        return id;
    }

    public String getRfqNumber() {
        return rfqNumber;
    }

    public void setRfqNumber(
            String rfqNumber
    ) {
        this.rfqNumber = rfqNumber;
    }

    public PurchaseRequestEntity getSourcePurchaseRequest() {
        return sourcePurchaseRequest;
    }

    public void setSourcePurchaseRequest(
            PurchaseRequestEntity sourcePurchaseRequest
    ) {
        this.sourcePurchaseRequest =
                sourcePurchaseRequest;
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

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(
            String currency
    ) {
        this.currency = currency;
    }

    public LocalDateTime getResponseDeadline() {
        return responseDeadline;
    }

    public void setResponseDeadline(
            LocalDateTime responseDeadline
    ) {
        this.responseDeadline =
                responseDeadline;
    }

    public RfqStatus getStatus() {
        return status;
    }

    public void setStatus(
            RfqStatus status
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

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(
            Instant publishedAt
    ) {
        this.publishedAt = publishedAt;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(
            Instant closedAt
    ) {
        this.closedAt = closedAt;
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

    public List<RfqLineItemEntity> getLineItems() {
        return lineItems;
    }

    public List<RfqSupplierInvitationEntity> getInvitations() {
        return invitations;
    }
}
