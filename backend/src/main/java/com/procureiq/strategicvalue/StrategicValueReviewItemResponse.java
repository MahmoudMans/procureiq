package com.procureiq.strategicvalue;

import java.math.BigDecimal;
import java.util.UUID;

public record StrategicValueReviewItemResponse(
        UUID valueCaseId,
        String caseNumber,
        String persistencePlanNumber,
        String commitmentNumber,
        String initiativeNumber,
        String initiativeTitle,
        String valueOwnerName,
        StrategicValueCaseStatus caseStatus,
        String currency,
        BigDecimal investmentCostAmount,
        BigDecimal annualOperatingCostAmount,
        BigDecimal annualizedValueAmount,
        BigDecimal persistencePct,
        BigDecimal baselineHorizonValueAmount,
        BigDecimal durableHorizonValueAmount,
        BigDecimal decayedValueAmount,
        BigDecimal totalCostAmount,
        BigDecimal netValueAmount,
        BigDecimal roiPct,
        BigDecimal paybackMonths,
        BigDecimal valueAtRiskAmount,
        StrategicValueHealth valueHealth
) {
}
