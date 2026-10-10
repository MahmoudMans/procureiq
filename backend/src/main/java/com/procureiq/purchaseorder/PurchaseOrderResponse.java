package com.procureiq.purchaseorder;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PurchaseOrderResponse(
        UUID id,
        String poNumber,
        UUID rfqId,
        String rfqNumber,
        UUID purchaseRequestId,
        String purchaseRequestNumber,
        UUID awardDecisionId,
        UUID quotationId,
        String quotationNumber,
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String currency,
        String paymentTerms,
        LocalDate expectedDeliveryDate,
        String deliveryAddress,
        String buyerNotes,
        BigDecimal subtotal,
        BigDecimal discountAmount,
        BigDecimal shippingAmount,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        PurchaseOrderStatus status,
        UUID createdByUserId,
        String createdByName,
        UUID issuedByUserId,
        String issuedByName,
        List<PurchaseOrderLineResponse> lines,
        Instant issuedAt,
        Instant cancelledAt,
        Instant createdAt,
        Instant updatedAt,
        long version,
        String supplierResponse,
        Instant supplierRespondedAt,
        String supplierResponseNote
) {
}
