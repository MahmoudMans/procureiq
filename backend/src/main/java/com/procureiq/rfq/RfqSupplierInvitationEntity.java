package com.procureiq.rfq;

import com.procureiq.supplier.SupplierEntity;
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

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rfq_supplier_invitations")
public class RfqSupplierInvitationEntity {

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

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "supplier_id",
            nullable = false
    )
    private SupplierEntity supplier;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 30
    )
    private RfqInvitationStatus status;

    @Column(
            name = "invited_at",
            nullable = false
    )
    private Instant invitedAt;

    @Column(
            name = "responded_at"
    )
    private Instant respondedAt;

    @PrePersist
    void prePersist() {
        if (invitedAt == null) {
            invitedAt = Instant.now();
        }

        if (status == null) {
            status = RfqInvitationStatus.INVITED;
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

    public SupplierEntity getSupplier() {
        return supplier;
    }

    public void setSupplier(
            SupplierEntity supplier
    ) {
        this.supplier = supplier;
    }

    public RfqInvitationStatus getStatus() {
        return status;
    }

    public void setStatus(
            RfqInvitationStatus status
    ) {
        this.status = status;
    }

    public Instant getInvitedAt() {
        return invitedAt;
    }

    public Instant getRespondedAt() {
        return respondedAt;
    }

    public void setRespondedAt(
            Instant respondedAt
    ) {
        this.respondedAt = respondedAt;
    }
}
