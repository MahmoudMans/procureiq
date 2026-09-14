package com.procureiq.suppliercollaboration;

import java.util.UUID;

public record CollaborationPurchaseOrderOptionResponse(
        UUID id,
        String purchaseOrderNumber,
        UUID supplierId
) {
}
