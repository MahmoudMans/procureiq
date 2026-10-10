package com.procureiq.supplierportal;

import com.procureiq.quotation.QuotationLineResponse;
import com.procureiq.quotation.QuotationStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** A supplier's own quotation. Deliberately leaves out internal user details. */
public record SupplierPortalQuotationResponse(
        UUID id,
        String quotationNumber,
        QuotationStatus status,
        String currency,
        int leadTimeDays,
        String paymentTerms,
        LocalDate validityDate,
        BigDecimal subtotal,
        BigDecimal discountAmount,
        BigDecimal shippingAmount,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        List<QuotationLineResponse> lines,
        Instant submittedAt,
        Instant withdrawnAt,
        Instant updatedAt
) {
}
