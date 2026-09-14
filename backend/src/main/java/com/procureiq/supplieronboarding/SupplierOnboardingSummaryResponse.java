package com.procureiq.supplieronboarding;

public record SupplierOnboardingSummaryResponse(
        long totalCases,
        long draftCases,
        long inReviewCases,
        long overdueCases,
        long activationReadyCases,
        long approvedCases,
        long rejectedCases,
        long requalificationDueWithin30Days,
        long requalificationExpired,
        long highCriticalRiskCases
) {
}
