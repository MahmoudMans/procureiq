package com.procureiq.supplier;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SupplierResponse(
        UUID id,
        String supplierCode,
        String legalName,
        String tradingName,
        String contactEmail,
        String phone,
        String website,
        String country,
        String city,
        String category,
        SupplierStatus status,
        SupplierRiskLevel riskLevel,
        BigDecimal rating,
        BigDecimal onTimeDeliveryRate,
        BigDecimal totalSpend,
        Instant createdAt,
        Instant updatedAt
) {
}
