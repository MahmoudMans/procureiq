package com.procureiq.suppliermonitoring;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SupplierRiskEvaluationResponse(
        UUID id,
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String supplierCategory,
        String supplierCountry,
        String currency,
        BigDecimal overallScore,
        SupplierContinuousRiskBand riskBand,
        SupplierRiskRecommendation recommendation,
        BigDecimal previousScore,
        BigDecimal deltaScore,
        boolean deterioration,
        BigDecimal spendExposure,
        BigDecimal categorySpendShare,
        List<SupplierRiskFactorResponse> factors,
        Instant evaluatedAt
) {
}
