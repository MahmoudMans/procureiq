package com.procureiq.sustainability;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SustainabilityPortfolioResponse(
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String category,
        String country,
        String supplierRiskLevel,

        String currency,
        BigDecimal spend,

        UUID assessmentId,
        String assessmentNumber,
        SustainabilityAssessmentStatus assessmentStatus,
        SustainabilityRating rating,

        BigDecimal environmentalScore,
        BigDecimal socialScore,
        BigDecimal governanceScore,
        BigDecimal overallScore,

        LocalDate nextReviewDate,

        boolean onboardingClearance,
        boolean responsibleSourcingEligible,

        long openActions,
        long overdueActions
) {
}
