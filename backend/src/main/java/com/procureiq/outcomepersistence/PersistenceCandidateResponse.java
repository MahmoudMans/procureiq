package com.procureiq.outcomepersistence;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record PersistenceCandidateResponse(
        UUID commitmentId,
        String commitmentNumber,
        UUID roadmapId,
        String roadmapNumber,
        String initiativeNumber,
        String initiativeTitle,
        String executionOwnerName,
        String currency,
        int fiscalYear,
        LocalDate completedOn,
        BigDecimal validatedContributionPoints
) {
}
