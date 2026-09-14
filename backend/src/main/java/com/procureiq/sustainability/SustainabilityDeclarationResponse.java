package com.procureiq.sustainability;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SustainabilityDeclarationResponse(
        UUID id,
        SustainabilityDeclarationType declarationType,
        boolean mandatory,
        String documentReference,
        LocalDate expiryDate,
        SustainabilityDeclarationStatus status,
        String reviewedByName,
        String reviewNote,
        Instant reviewedAt
) {
}
