package com.procureiq.commercialgovernance;

import java.math.BigDecimal;

public record CommercialGovernanceSummaryResponse(
        String currency,
        long governedContracts,
        long activeGovernanceRecords,
        long renewalReviews,
        long noticesDueWithin30Days,
        long expiredContracts,
        long openObligations,
        long overdueObligations,
        long openLeakageFindings,
        long criticalLeakageFindings,
        BigDecimal leakageExposure,
        BigDecimal governedContractValue
) {
}
