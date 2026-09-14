package com.procureiq.risk;

import com.procureiq.user.AppUserEntity;
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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "risk_mitigation_actions")
public class RiskMitigationActionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "risk_case_id",
            nullable = false
    )
    private ProcurementRiskCaseEntity riskCase;

    @Column(
            name = "title",
            nullable = false,
            length = 220
    )
    private String title;

    @Column(
            name = "description",
            length = 2000
    )
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 30
    )
    private MitigationActionStatus status;

    @Column(
            name = "due_date"
    )
    private LocalDate dueDate;

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
            name = "completed_at"
    )
    private Instant completedAt;

    @ManyToOne(
            fetch = FetchType.LAZY
    )
    @JoinColumn(
            name = "completed_by_user_id"
    )
    private AppUserEntity completedBy;

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

    @PrePersist
    void prePersist() {
        Instant now =
                Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;

        if (status == null) {
            status =
                    MitigationActionStatus.OPEN;
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

    public ProcurementRiskCaseEntity getRiskCase() {
        return riskCase;
    }

    public void setRiskCase(
            ProcurementRiskCaseEntity riskCase
    ) {
        this.riskCase =
                riskCase;
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

    public MitigationActionStatus getStatus() {
        return status;
    }

    public void setStatus(
            MitigationActionStatus status
    ) {
        this.status = status;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(
            LocalDate dueDate
    ) {
        this.dueDate = dueDate;
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

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(
            Instant completedAt
    ) {
        this.completedAt =
                completedAt;
    }

    public AppUserEntity getCompletedBy() {
        return completedBy;
    }

    public void setCompletedBy(
            AppUserEntity completedBy
    ) {
        this.completedBy =
                completedBy;
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
}
