package com.procureiq.delivery;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record GoodsReceiptResponse(
        UUID id,
        String receiptNumber,
        UUID purchaseOrderId,
        String purchaseOrderNumber,
        LocalDate receivedDate,
        String deliveryReference,
        String notes,
        boolean lateReceipt,
        UUID recordedByUserId,
        String recordedByName,
        List<GoodsReceiptLineResponse> lines,
        Instant createdAt
) {
}
