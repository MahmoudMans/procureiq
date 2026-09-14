package com.procureiq.approval;

import com.procureiq.user.ProcurementRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "approval_policies")
public class ApprovalPolicyEntity {

    @Id
    private UUID id;

    @Column(
            name = "policy_code",
            nullable = false,
            unique = true,
            length = 60
    )
    private String policyCode;

    @Column(
            name = "policy_name",
            nullable = false,
            length = 160
    )
    private String policyName;

    @Column(
            name = "description",
            length = 500
    )
    private String description;

    @Column(
            name = "minimum_amount",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal minimumAmount;

    @Column(
            name = "maximum_amount",
            precision = 19,
            scale = 2
    )
    private BigDecimal maximumAmount;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "required_role",
            nullable = false,
            length = 40
    )
    private ProcurementRole requiredRole;

    @Column(
            name = "priority",
            nullable = false
    )
    private int priority;

    @Column(
            name = "active",
            nullable = false
    )
    private boolean active;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public String getPolicyCode() {
        return policyCode;
    }

    public String getPolicyName() {
        return policyName;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getMinimumAmount() {
        return minimumAmount;
    }

    public BigDecimal getMaximumAmount() {
        return maximumAmount;
    }

    public ProcurementRole getRequiredRole() {
        return requiredRole;
    }

    public int getPriority() {
        return priority;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
