package com.procureiq.savings;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SavingsRealizationResponse(
        UUID id,
        SavingsRealizationSourceType sourceType,
        UUID purchaseOrderId,
        String purchaseOrderNumber,
        LocalDate realizationDate,
        BigDecimal amount,
        String notes,
        UUID createdByUserId,
        String createdByName,
        Instant createdAt
) {
}
