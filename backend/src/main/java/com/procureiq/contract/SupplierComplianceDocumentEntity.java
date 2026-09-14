package com.procureiq.contract;

import com.procureiq.supplier.SupplierEntity;
import com.procureiq.user.AppUserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "supplier_compliance_documents")
public class SupplierComplianceDocumentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "supplier_id",
            nullable = false
    )
    private SupplierEntity supplier;

    @ManyToOne(
            fetch = FetchType.LAZY
    )
    @JoinColumn(
            name = "contract_id"
    )
    private SupplierContractEntity contract;

    @Column(
            name = "document_type",
            nullable = false,
            length = 120
    )
    private String documentType;

    @Column(
            name = "document_name",
            nullable = false,
            length = 200
    )
    private String documentName;

    @Column(
            name = "document_reference",
            length = 200
    )
    private String documentReference;

    @Column(
            name = "required",
            nullable = false
    )
    private boolean required;

    @Column(
            name = "issue_date"
    )
    private LocalDate issueDate;

    @Column(
            name = "expiry_date"
    )
    private LocalDate expiryDate;

    @Column(
            name = "notes",
            length = 2000
    )
    private String notes;

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
    }

    @PreUpdate
    void preUpdate() {
        updatedAt =
                Instant.now();
    }

    public UUID getId() {
        return id;
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

    public String getDocumentType() {
        return documentType;
    }

    public void setDocumentType(
            String documentType
    ) {
        this.documentType =
                documentType;
    }

    public String getDocumentName() {
        return documentName;
    }

    public void setDocumentName(
            String documentName
    ) {
        this.documentName =
                documentName;
    }

    public String getDocumentReference() {
        return documentReference;
    }

    public void setDocumentReference(
            String documentReference
    ) {
        this.documentReference =
                documentReference;
    }

    public boolean isRequired() {
        return required;
    }

    public void setRequired(
            boolean required
    ) {
        this.required = required;
    }

    public LocalDate getIssueDate() {
        return issueDate;
    }

    public void setIssueDate(
            LocalDate issueDate
    ) {
        this.issueDate = issueDate;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(
            LocalDate expiryDate
    ) {
        this.expiryDate = expiryDate;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(
            String notes
    ) {
        this.notes = notes;
    }

    public AppUserEntity getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(
            AppUserEntity createdBy
    ) {
        this.createdBy = createdBy;
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
