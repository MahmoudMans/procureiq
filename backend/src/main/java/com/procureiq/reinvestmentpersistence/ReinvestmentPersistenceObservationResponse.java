package com.procureiq.reinvestmentpersistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ReinvestmentPersistenceObservationResponse(
        UUID id,
        UUID persistenceCaseId,
        LocalDate observedOn,

        BigDecimal reportedCurrentAnnualizedValueAmount,

        String evidenceNote,
        String reportedByName,
        Instant reportedAt,

        ReinvestmentPersistenceValidationDecision validationDecision,
        BigDecimal validatedCurrentAnnualizedValueAmount,
        String validationNote,
        String validatedByName,
        Instant validatedAt
) {
}
