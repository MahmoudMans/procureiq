package com.procureiq.quotation;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record QuotationComparisonResponse(
        UUID rfqId,
        String rfqNumber,
        String currency,
        int submittedQuotationCount,
        UUID lowestQuotationId,
        BigDecimal lowestTotalAmount,
        BigDecimal highestTotalAmount,
        BigDecimal potentialSavings,
        List<QuotationComparisonItemResponse> quotations
) {
}
