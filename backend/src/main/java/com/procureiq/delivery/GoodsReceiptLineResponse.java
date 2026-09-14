package com.procureiq.delivery;

import java.math.BigDecimal;
import java.util.UUID;

public record GoodsReceiptLineResponse(
        UUID id,
        UUID purchaseOrderLineId,
        int lineNumber,
        String itemName,
        BigDecimal orderedQuantity,
        BigDecimal quantityReceived,
        String unit
) {
}
