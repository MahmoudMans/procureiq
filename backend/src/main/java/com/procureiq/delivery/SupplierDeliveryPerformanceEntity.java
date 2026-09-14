package com.procureiq.delivery;

import com.procureiq.supplier.SupplierEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "supplier_delivery_performance")
public class SupplierDeliveryPerformanceEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "supplier_id",
            nullable = false,
            unique = true
    )
    private SupplierEntity supplier;

    @Column(
            name = "tracked_orders",
            nullable = false
    )
    private long trackedOrders;

    @Column(
            name = "completed_orders",
            nullable = false
    )
    private long completedOrders;

    @Column(
            name = "on_time_orders",
            nullable = false
    )
    private long onTimeOrders;

    @Column(
            name = "late_orders",
            nullable = false
    )
    private long lateOrders;

    @Column(
            name = "ordered_quantity",
            nullable = false,
            precision = 19,
            scale = 3
    )
    private BigDecimal orderedQuantity;

    @Column(
            name = "received_quantity",
            nullable = false,
            precision = 19,
            scale = 3
    )
    private BigDecimal receivedQuantity;

    @Column(
            name = "on_time_delivery_rate",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal onTimeDeliveryRate;

    @Column(
            name = "fulfillment_rate",
            nullable = false,
            precision = 5,
            scale = 2
    )
    private BigDecimal fulfillmentRate;

    @Column(
            name = "last_receipt_date"
    )
    private LocalDate lastReceiptDate;

    @Column(
            name = "updated_at",
            nullable = false
    )
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
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

    public long getTrackedOrders() {
        return trackedOrders;
    }

    public void setTrackedOrders(
            long trackedOrders
    ) {
        this.trackedOrders = trackedOrders;
    }

    public long getCompletedOrders() {
        return completedOrders;
    }

    public void setCompletedOrders(
            long completedOrders
    ) {
        this.completedOrders = completedOrders;
    }

    public long getOnTimeOrders() {
        return onTimeOrders;
    }

    public void setOnTimeOrders(
            long onTimeOrders
    ) {
        this.onTimeOrders = onTimeOrders;
    }

    public long getLateOrders() {
        return lateOrders;
    }

    public void setLateOrders(
            long lateOrders
    ) {
        this.lateOrders = lateOrders;
    }

    public BigDecimal getOrderedQuantity() {
        return orderedQuantity;
    }

    public void setOrderedQuantity(
            BigDecimal orderedQuantity
    ) {
        this.orderedQuantity =
                orderedQuantity;
    }

    public BigDecimal getReceivedQuantity() {
        return receivedQuantity;
    }

    public void setReceivedQuantity(
            BigDecimal receivedQuantity
    ) {
        this.receivedQuantity =
                receivedQuantity;
    }

    public BigDecimal getOnTimeDeliveryRate() {
        return onTimeDeliveryRate;
    }

    public void setOnTimeDeliveryRate(
            BigDecimal onTimeDeliveryRate
    ) {
        this.onTimeDeliveryRate =
                onTimeDeliveryRate;
    }

    public BigDecimal getFulfillmentRate() {
        return fulfillmentRate;
    }

    public void setFulfillmentRate(
            BigDecimal fulfillmentRate
    ) {
        this.fulfillmentRate =
                fulfillmentRate;
    }

    public LocalDate getLastReceiptDate() {
        return lastReceiptDate;
    }

    public void setLastReceiptDate(
            LocalDate lastReceiptDate
    ) {
        this.lastReceiptDate =
                lastReceiptDate;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
