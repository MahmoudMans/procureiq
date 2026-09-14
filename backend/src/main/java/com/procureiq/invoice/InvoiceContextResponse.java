package com.procureiq.invoice;

import java.util.List;

public record InvoiceContextResponse(
        List<InvoicePurchaseOrderOptionResponse> purchaseOrders
) {
}
