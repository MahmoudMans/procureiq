package com.procureiq.investmentperformance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record InvestmentPerformanceObservationResponse(
        UUID id,
        UUID performanceCaseId,
        LocalDate observedOn,
        BigDecimal releasedCapitalSnapshot,
        BigDecimal releasePctSnapshot,
        BigDecimal reportedRealizedAnnualizedValueAmount,
        String evidenceNote,
        String reportedByName,
        Instant reportedAt,

        InvestmentPerformanceValidationDecision validationDecision,
        BigDecimal validatedRealizedAnnualizedValueAmount,
        String validationNote,
        String validatedByName,
        Instant validatedAt
) {
}
