package com.procureiq.outcomepersistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record PersistenceObservationResponse(
        UUID id,
        UUID planId,
        LocalDate observedOn,
        BigDecimal reportedContributionPoints,
        String evidenceNote,
        String reportedByName,
        Instant reportedAt,
        PersistenceValidationDecision validationDecision,
        BigDecimal validatedContributionPoints,
        String validationNote,
        String validatedByName,
        Instant validatedAt
) {
}
