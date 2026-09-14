package com.procureiq.contract;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ContractResponse(
        UUID id,
        String contractNumber,
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String title,
        String contractType,
        ContractStatus status,
        LocalDate startDate,
        LocalDate endDate,
        String currency,
        BigDecimal contractValue,
        boolean autoRenew,
        int noticePeriodDays,
        UUID ownerUserId,
        String ownerName,
        String notes,
        long daysUntilExpiry,
        boolean expiringSoon,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
