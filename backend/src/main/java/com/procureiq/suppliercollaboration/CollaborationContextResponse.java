package com.procureiq.suppliercollaboration;

import java.util.List;

public record CollaborationContextResponse(
        List<CollaborationSupplierOptionResponse> suppliers,
        List<CollaborationUserOptionResponse> users,
        List<CollaborationPurchaseOrderOptionResponse> purchaseOrders,
        List<CollaborationRfqOptionResponse> rfqs
) {
}
