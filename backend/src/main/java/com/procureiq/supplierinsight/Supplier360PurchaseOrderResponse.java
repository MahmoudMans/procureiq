package com.procureiq.supplierinsight;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record Supplier360PurchaseOrderResponse(
        UUID id,
        String poNumber,
        String rfqNumber,
        String status,
        BigDecimal totalAmount,
        LocalDate expectedDeliveryDate,
        Instant issuedAt,
        Instant createdAt
) {
}
