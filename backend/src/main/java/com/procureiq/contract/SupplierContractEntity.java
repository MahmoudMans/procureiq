package com.procureiq.contract;

import com.procureiq.supplier.SupplierEntity;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "supplier_contracts")
public class SupplierContractEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(
            name = "contract_number",
            nullable = false,
            unique = true,
            length = 40
    )
    private String contractNumber;

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
            name = "title",
            nullable = false,
            length = 200
    )
    private String title;

    @Column(
            name = "contract_type",
            nullable = false,
            length = 100
    )
    private String contractType;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 30
    )
    private ContractStatus status;

    @Column(
            name = "start_date",
            nullable = false
    )
    private LocalDate startDate;

    @Column(
            name = "end_date",
            nullable = false
    )
    private LocalDate endDate;

    @Column(
            name = "currency",
            nullable = false,
            length = 3
    )
    private String currency;

    @Column(
            name = "contract_value",
            nullable = false,
            precision = 19,
            scale = 2
    )
    private BigDecimal contractValue;

    @Column(
            name = "auto_renew",
            nullable = false
    )
    private boolean autoRenew;

    @Column(
            name = "notice_period_days",
            nullable = false
    )
    private int noticePeriodDays;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "owner_user_id",
            nullable = false
    )
    private AppUserEntity owner;

    @Column(
            name = "notes",
            length = 2000
    )
    private String notes;

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
                    ContractStatus.DRAFT;
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

    public String getContractNumber() {
        return contractNumber;
    }

    public void setContractNumber(
            String contractNumber
    ) {
        this.contractNumber =
                contractNumber;
    }

    public SupplierEntity getSupplier() {
        return supplier;
    }

    public void setSupplier(
            SupplierEntity supplier
    ) {
        this.supplier = supplier;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(
            String title
    ) {
        this.title = title;
    }

    public String getContractType() {
        return contractType;
    }

    public void setContractType(
            String contractType
    ) {
        this.contractType =
                contractType;
    }

    public ContractStatus getStatus() {
        return status;
    }

    public void setStatus(
            ContractStatus status
    ) {
        this.status = status;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(
            LocalDate startDate
    ) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(
            LocalDate endDate
    ) {
        this.endDate = endDate;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(
            String currency
    ) {
        this.currency = currency;
    }

    public BigDecimal getContractValue() {
        return contractValue;
    }

    public void setContractValue(
            BigDecimal contractValue
    ) {
        this.contractValue =
                contractValue;
    }

    public boolean isAutoRenew() {
        return autoRenew;
    }

    public void setAutoRenew(
            boolean autoRenew
    ) {
        this.autoRenew = autoRenew;
    }

    public int getNoticePeriodDays() {
        return noticePeriodDays;
    }

    public void setNoticePeriodDays(
            int noticePeriodDays
    ) {
        this.noticePeriodDays =
                noticePeriodDays;
    }

    public AppUserEntity getOwner() {
        return owner;
    }

    public void setOwner(
            AppUserEntity owner
    ) {
        this.owner = owner;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(
            String notes
    ) {
        this.notes = notes;
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
