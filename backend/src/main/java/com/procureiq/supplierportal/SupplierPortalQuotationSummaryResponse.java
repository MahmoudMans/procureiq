package com.procureiq.supplierportal;

import com.procureiq.quotation.QuotationStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SupplierPortalQuotationSummaryResponse(
        UUID id,
        String quotationNumber,
        QuotationStatus status,
        BigDecimal totalAmount,
        Instant submittedAt
) {
}
