package com.procureiq.purchaseorder;

import java.math.BigDecimal;

public record PurchaseOrderSummaryResponse(
        long totalOrders,
        long draftOrders,
        long issuedOrders,
        long cancelledOrders,
        BigDecimal issuedValue,
        BigDecimal draftValue
) {
}
