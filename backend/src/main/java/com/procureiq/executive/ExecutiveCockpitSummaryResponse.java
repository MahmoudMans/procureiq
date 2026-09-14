package com.procureiq.executive;

import java.math.BigDecimal;

public record ExecutiveCockpitSummaryResponse(
        String currency,

        long generatedWarnings,
        long unacknowledgedWarnings,
        long criticalWarnings,
        long highWarnings,

        BigDecimal riskExposure,
        BigDecimal opportunityValue,

        BigDecimal overdueInvoiceExposure,
        BigDecimal paymentHoldExposure,
        BigDecimal commercialLeakageExposure,
        BigDecimal demandSavingsOpportunity,

        long criticalSupplierSignals,
        long processBottlenecks
) {
}
