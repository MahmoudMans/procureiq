package com.procureiq.purchaserequest;

import java.math.BigDecimal;
import java.util.UUID;

public record PurchaseRequestItemResponse(
        UUID id,
        int lineNumber,
        String itemName,
        String description,
        String category,
        BigDecimal quantity,
        String unit,
        BigDecimal estimatedUnitPrice,
        BigDecimal estimatedLineTotal
) {
}
