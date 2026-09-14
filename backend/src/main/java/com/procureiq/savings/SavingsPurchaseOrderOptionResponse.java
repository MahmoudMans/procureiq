package com.procureiq.savings;

import java.math.BigDecimal;
import java.util.UUID;

public record SavingsPurchaseOrderOptionResponse(
        UUID id,
        String purchaseOrderNumber,
        UUID rfqId,
        UUID supplierId,
        String supplierName,
        String currency,
        BigDecimal totalAmount,
        String status
) {
}
