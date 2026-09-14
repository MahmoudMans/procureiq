package com.procureiq.savings;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SavingsInitiativeResponse(
        UUID id,
        String savingsNumber,
        SavingsOrigin origin,
        String title,
        SavingsType savingsType,
        SavingsStatus status,

        int fiscalYear,
        String currency,
        String category,

        UUID rfqId,
        String rfqNumber,

        UUID supplierId,
        String supplierName,

        UUID purchaseOrderId,
        String purchaseOrderNumber,

        BigDecimal baselineValue,
        BigDecimal negotiatedValue,
        BigDecimal targetSavings,
        BigDecimal realizedSavings,
        BigDecimal remainingSavings,
        BigDecimal realizationRate,

        UUID ownerUserId,
        String ownerName,

        String decisionNote,
        Instant decisionAt,
        String decidedByName,

        String notes,

        List<SavingsRealizationResponse> realizations,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
