package com.procureiq.suppliermonitoring;

import java.math.BigDecimal;
import java.util.List;

public record SupplierRiskScoreResult(
        BigDecimal overallScore,
        SupplierContinuousRiskBand riskBand,
        SupplierRiskRecommendation recommendation,
        List<SupplierRiskFactorResult> factors
) {
}
