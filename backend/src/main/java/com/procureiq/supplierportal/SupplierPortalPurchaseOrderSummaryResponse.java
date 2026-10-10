package com.procureiq.supplierportal;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SupplierPortalPurchaseOrderSummaryResponse(
        UUID id,
        String poNumber,
        UUID rfqId,
        String rfqNumber,
        String currency,
        BigDecimal totalAmount,
        LocalDate expectedDeliveryDate,
        String status,
        String supplierResponse,
        Instant supplierRespondedAt,
        Instant issuedAt
) {
}
