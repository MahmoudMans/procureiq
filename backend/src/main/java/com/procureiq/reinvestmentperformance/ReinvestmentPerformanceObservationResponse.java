package com.procureiq.reinvestmentperformance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ReinvestmentPerformanceObservationResponse(
        UUID id,
        UUID performanceCaseId,
        LocalDate observedOn,
        BigDecimal reportedRealizedAnnualizedValueAmount,
        String evidenceNote,
        String reportedByName,
        Instant reportedAt,

        ReinvestmentPerformanceValidationDecision validationDecision,
        BigDecimal validatedRealizedAnnualizedValueAmount,
        String validationNote,
        String validatedByName,
        Instant validatedAt
) {
}
