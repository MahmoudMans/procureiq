package com.procureiq.supplieronboarding;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record OnboardingEvidenceResponse(
        UUID id,
        OnboardingEvidenceType evidenceType,
        boolean mandatory,
        String documentReference,
        LocalDate expiryDate,
        OnboardingEvidenceStatus status,
        String reviewedByName,
        String reviewNote,
        Instant reviewedAt
) {
}
