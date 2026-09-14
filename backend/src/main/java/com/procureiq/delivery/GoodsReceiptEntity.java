package com.procureiq.delivery;

import com.procureiq.purchaseorder.PurchaseOrderEntity;
import com.procureiq.user.AppUserEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "goods_receipts")
public class GoodsReceiptEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(
            name = "receipt_number",
            nullable = false,
            unique = true,
            length = 40
    )
    private String receiptNumber;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "purchase_order_id",
            nullable = false
    )
    private PurchaseOrderEntity purchaseOrder;

    @Column(
            name = "received_date",
            nullable = false
    )
    private LocalDate receivedDate;

    @Column(
            name = "delivery_reference",
            length = 160
    )
    private String deliveryReference;

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
            name = "recorded_by_user_id",
            nullable = false
    )
    private AppUserEntity recordedBy;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private Instant createdAt;

    @OneToMany(
            mappedBy = "receipt",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("purchaseOrderLine.lineNumber ASC")
    private List<GoodsReceiptLineEntity> lines =
            new ArrayList<>();

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public void replaceLines(
            List<GoodsReceiptLineEntity> newLines
    ) {
        lines.clear();

        for (
                GoodsReceiptLineEntity line
                : newLines
        ) {
            line.setReceipt(this);
            lines.add(line);
        }
    }

    public UUID getId() {
        return id;
    }

    public String getReceiptNumber() {
        return receiptNumber;
    }

    public void setReceiptNumber(
            String receiptNumber
    ) {
        this.receiptNumber = receiptNumber;
    }

    public PurchaseOrderEntity getPurchaseOrder() {
        return purchaseOrder;
    }

    public void setPurchaseOrder(
            PurchaseOrderEntity purchaseOrder
    ) {
        this.purchaseOrder = purchaseOrder;
    }

    public LocalDate getReceivedDate() {
        return receivedDate;
    }

    public void setReceivedDate(
            LocalDate receivedDate
    ) {
        this.receivedDate = receivedDate;
    }

    public String getDeliveryReference() {
        return deliveryReference;
    }

    public void setDeliveryReference(
            String deliveryReference
    ) {
        this.deliveryReference =
                deliveryReference;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(
            String notes
    ) {
        this.notes = notes;
    }

    public AppUserEntity getRecordedBy() {
        return recordedBy;
    }

    public void setRecordedBy(
            AppUserEntity recordedBy
    ) {
        this.recordedBy = recordedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<GoodsReceiptLineEntity> getLines() {
        return lines;
    }
}
