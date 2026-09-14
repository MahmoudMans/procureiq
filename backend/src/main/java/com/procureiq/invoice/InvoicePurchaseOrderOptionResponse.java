package com.procureiq.invoice;

import java.math.BigDecimal;
import java.util.UUID;

public record InvoicePurchaseOrderOptionResponse(
        UUID id,
        String purchaseOrderNumber,
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String currency,
        BigDecimal totalAmount,
        String status
) {
}
