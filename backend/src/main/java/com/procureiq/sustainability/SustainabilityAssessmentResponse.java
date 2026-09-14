package com.procureiq.sustainability;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SustainabilityAssessmentResponse(
        UUID id,
        String assessmentNumber,

        UUID supplierId,
        String supplierCode,
        String supplierName,
        String supplierCategory,
        String supplierCountry,
        String supplierRiskLevel,

        SustainabilityAssessmentStatus status,

        BigDecimal environmentalScore,
        BigDecimal socialScore,
        BigDecimal governanceScore,
        BigDecimal overallScore,

        SustainabilityRating rating,

        LocalDate assessmentDate,
        LocalDate nextReviewDate,

        UUID ownerUserId,
        String ownerName,

        String reviewedByName,
        String reviewNote,
        Instant reviewedAt,

        String notes,

        int mandatoryDeclarations,
        int verifiedMandatoryDeclarations,

        boolean onboardingClearance,
        boolean responsibleSourcingEligible,

        long openActions,
        long overdueActions,

        List<SustainabilityDeclarationResponse> declarations,
        List<SustainabilityActionResponse> actions,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
