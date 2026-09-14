package com.procureiq.benefitgovernance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record BenefitItemResponse(
        UUID id,
        UUID portfolioId,

        UUID scenarioItemId,
        UUID initiativeId,
        UUID strategyId,

        String categoryName,
        String initiativeNumber,
        String initiativeTitle,

        UUID benefitOwnerUserId,
        String benefitOwnerName,

        BenefitItemStatus status,

        BigDecimal baselineTargetSavings,
        BigDecimal forecastSavings,
        BigDecimal operationalReportedSavings,
        BigDecimal validationRequestedAmount,
        BigDecimal validatedSavings,

        BigDecimal forecastGap,
        BigDecimal validationGap,

        BigDecimal activeLeakageAmount,
        BigDecimal atRiskAmount,

        LocalDate expectedRealizationDate,

        String validationRequestNote,
        String validationRequestedByName,
        Instant validationRequestedAt,

        String validatedByName,
        String validationNote,
        Instant validatedAt,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
