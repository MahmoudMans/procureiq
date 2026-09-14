package com.procureiq.delivery;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SupplierDeliveryPerformanceResponse(
        UUID supplierId,
        String supplierCode,
        String supplierName,
        long trackedOrders,
        long completedOrders,
        long onTimeOrders,
        long lateOrders,
        BigDecimal orderedQuantity,
        BigDecimal receivedQuantity,
        BigDecimal onTimeDeliveryRate,
        BigDecimal fulfillmentRate,
        LocalDate lastReceiptDate,
        Instant updatedAt
) {
}
