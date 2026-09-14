package com.procureiq.evaluation;

import com.procureiq.supplier.SupplierRiskLevel;

import java.math.BigDecimal;
import java.util.UUID;

public record SupplierEvaluationResponse(
        UUID evaluationId,
        UUID quotationId,
        String quotationNumber,
        UUID supplierId,
        String supplierName,
        BigDecimal quotationTotal,
        int leadTimeDays,
        BigDecimal supplierRating,
        SupplierRiskLevel supplierRiskLevel,
        BigDecimal priceScore,
        BigDecimal deliveryScore,
        BigDecimal supplierRatingScore,
        BigDecimal riskScore,
        BigDecimal qualityScore,
        BigDecimal weightedTotalScore,
        int rankPosition,
        boolean recommended
) {
}
