package com.procureiq.outcomepersistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record PersistencePlanResponse(
        UUID id,
        String planNumber,
        UUID commitmentId,
        String commitmentNumber,
        UUID roadmapId,
        String roadmapNumber,
        String initiativeNumber,
        String initiativeTitle,
        String executionOwnerName,
        UUID persistenceOwnerUserId,
        String persistenceOwnerName,
        String currency,
        int fiscalYear,
        BigDecimal baselineValidatedContributionPoints,
        LocalDate observationStartDate,
        LocalDate observationEndDate,
        BigDecimal minimumPersistencePct,
        String persistenceObjective,
        PersistencePlanStatus status,

        boolean assessed,
        BigDecimal currentValidatedContributionPoints,
        BigDecimal persistencePct,
        BigDecimal decayPoints,
        PersistenceHealth persistenceHealth,

        boolean observationDue,
        boolean verificationEligible,
        int observationCount,
        int verificationCount,
        int openControlCount,
        int overdueControlCount,

        String closeNote,
        String closedByName,
        Instant closedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
