package com.procureiq.evaluation;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record RfqEvaluationResponse(
        UUID rfqId,
        String rfqNumber,
        BigDecimal priceWeight,
        BigDecimal deliveryWeight,
        BigDecimal supplierRatingWeight,
        BigDecimal riskWeight,
        BigDecimal qualityWeight,
        UUID recommendedQuotationId,
        String recommendedSupplierName,
        int evaluatedSupplierCount,
        List<SupplierEvaluationResponse> scorecards
) {
}
