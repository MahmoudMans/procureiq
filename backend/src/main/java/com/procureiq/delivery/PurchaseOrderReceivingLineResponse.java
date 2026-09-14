package com.procureiq.delivery;

import java.math.BigDecimal;
import java.util.UUID;

public record PurchaseOrderReceivingLineResponse(
        UUID purchaseOrderLineId,
        int lineNumber,
        String itemName,
        BigDecimal orderedQuantity,
        BigDecimal receivedQuantity,
        BigDecimal remainingQuantity,
        String unit,
        boolean complete
) {
}
