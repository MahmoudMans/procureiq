package com.procureiq.quotation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record QuotationComparisonItemResponse(
        UUID quotationId,
        String quotationNumber,
        UUID supplierId,
        String supplierName,
        BigDecimal totalAmount,
        int rank,
        boolean lowestCost,
        BigDecimal varianceFromLowest,
        BigDecimal savingsVsHighest,
        int leadTimeDays,
        String paymentTerms,
        LocalDate validityDate
) {
}
