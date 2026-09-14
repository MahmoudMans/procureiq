package com.procureiq.quotation;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record QuotationResponse(
        UUID id,
        String quotationNumber,
        UUID rfqId,
        String rfqNumber,
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String currency,
        int leadTimeDays,
        String paymentTerms,
        LocalDate validityDate,
        BigDecimal subtotal,
        BigDecimal discountAmount,
        BigDecimal shippingAmount,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        QuotationStatus status,
        UUID recordedByUserId,
        String recordedByName,
        List<QuotationLineResponse> lines,
        Instant submittedAt,
        Instant withdrawnAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
