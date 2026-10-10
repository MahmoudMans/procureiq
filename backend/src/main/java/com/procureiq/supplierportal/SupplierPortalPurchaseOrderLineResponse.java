package com.procureiq.supplierportal;

import java.math.BigDecimal;

public record SupplierPortalPurchaseOrderLineResponse(
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
