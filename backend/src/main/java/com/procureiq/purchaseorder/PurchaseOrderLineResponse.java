package com.procureiq.purchaseorder;

import java.math.BigDecimal;
import java.util.UUID;

public record PurchaseOrderLineResponse(
        UUID id,
        int lineNumber,
        String itemName,
        String description,
        String category,
        BigDecimal quantity,
        String unit,
        BigDecimal unitPrice,
        BigDecimal lineTotal
) {
}
