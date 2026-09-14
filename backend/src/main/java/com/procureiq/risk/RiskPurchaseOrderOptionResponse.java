package com.procureiq.risk;

import java.util.UUID;

public record RiskPurchaseOrderOptionResponse(
        UUID id,
        String purchaseOrderNumber,
        UUID supplierId,
        String supplierName,
        String status
) {
}
