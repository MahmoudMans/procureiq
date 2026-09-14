package com.procureiq.suppliermonitoring;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SupplierRiskPortfolioItemResponse(
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String supplierCategory,
        String supplierCountry,
        String currency,
        UUID evaluationId,
        BigDecimal overallScore,
        SupplierContinuousRiskBand riskBand,
        SupplierRiskRecommendation recommendation,
        BigDecimal deltaScore,
        boolean deterioration,
        BigDecimal spendExposure,
        BigDecimal categorySpendShare,
        boolean watchlisted,
        long activeAlerts,
        long openEscalations,
        Instant evaluatedAt
) {
}
