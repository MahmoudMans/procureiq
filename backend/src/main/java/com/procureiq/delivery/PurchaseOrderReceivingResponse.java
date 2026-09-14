package com.procureiq.delivery;

import com.procureiq.purchaseorder.PurchaseOrderStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PurchaseOrderReceivingResponse(
        UUID purchaseOrderId,
        String purchaseOrderNumber,
        PurchaseOrderStatus status,
        LocalDate expectedDeliveryDate,
        boolean overdue,
        List<PurchaseOrderReceivingLineResponse> lines
) {
}
