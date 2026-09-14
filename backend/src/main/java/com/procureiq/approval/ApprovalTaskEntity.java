package com.procureiq.approval;

import com.procureiq.purchaserequest.PurchaseRequestEntity;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.ProcurementRole;
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
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "approval_tasks")
public class ApprovalTaskEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "purchase_request_id",
            nullable = false
    )
    private PurchaseRequestEntity purchaseRequest;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "policy_id",
            nullable = false
    )
    private ApprovalPolicyEntity policy;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "required_role",
            nullable = false,
            length = 40
    )
    private ProcurementRole requiredRole;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 30
    )
    private ApprovalTaskStatus status;

    @ManyToOne(
            fetch = FetchType.LAZY
    )
    @JoinColumn(
            name = "decided_by_user_id"
    )
    private AppUserEntity decidedBy;

    @Column(
            name = "decision_comment",
            length = 2000
    )
    private String decisionComment;

    @Column(
            name = "requested_at",
            nullable = false,
            updatable = false
    )
    private Instant requestedAt;

    @Column(
            name = "decided_at"
    )
    private Instant decidedAt;

    @Version
    @Column(
            name = "version",
            nullable = false
    )
    private long version;

    @PrePersist
    void prePersist() {
        if (requestedAt == null) {
            requestedAt = Instant.now();
        }

        if (status == null) {
            status = ApprovalTaskStatus.PENDING;
        }
    }

    public UUID getId() {
        return id;
    }

    public PurchaseRequestEntity getPurchaseRequest() {
        return purchaseRequest;
    }

    public void setPurchaseRequest(
            PurchaseRequestEntity purchaseRequest
    ) {
        this.purchaseRequest = purchaseRequest;
    }

    public ApprovalPolicyEntity getPolicy() {
        return policy;
    }

    public void setPolicy(
            ApprovalPolicyEntity policy
    ) {
        this.policy = policy;
    }

    public ProcurementRole getRequiredRole() {
        return requiredRole;
    }

    public void setRequiredRole(
            ProcurementRole requiredRole
    ) {
        this.requiredRole = requiredRole;
    }

    public ApprovalTaskStatus getStatus() {
        return status;
    }

    public void setStatus(
            ApprovalTaskStatus status
    ) {
        this.status = status;
    }

    public AppUserEntity getDecidedBy() {
        return decidedBy;
    }

    public void setDecidedBy(
            AppUserEntity decidedBy
    ) {
        this.decidedBy = decidedBy;
    }

    public String getDecisionComment() {
        return decisionComment;
    }

    public void setDecisionComment(
            String decisionComment
    ) {
        this.decisionComment = decisionComment;
    }

    public Instant getRequestedAt() {
        return requestedAt;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(
            Instant decidedAt
    ) {
        this.decidedAt = decidedAt;
    }

    public long getVersion() {
        return version;
    }
}
