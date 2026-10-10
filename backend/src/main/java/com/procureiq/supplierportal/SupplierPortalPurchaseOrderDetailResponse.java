package com.procureiq.supplierportal;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SupplierPortalPurchaseOrderDetailResponse(
        UUID id,
        String poNumber,
        UUID rfqId,
        String rfqNumber,
        String quotationNumber,
        String currency,
        String paymentTerms,
        LocalDate expectedDeliveryDate,
        String deliveryAddress,
        BigDecimal subtotal,
        BigDecimal discountAmount,
        BigDecimal shippingAmount,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        String status,
        String supplierResponse,
        Instant supplierRespondedAt,
        String supplierResponseNote,
        Instant issuedAt,
        Instant cancelledAt,
        List<SupplierPortalPurchaseOrderLineResponse> lines
) {
}
