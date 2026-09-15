package com.procureiq.strategyexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ExecutionProgressResponse(
        UUID id,
        UUID commitmentId,
        BigDecimal progressPct,
        LocalDate forecastEndDate,
        int blockerCount,
        String blockerSummary,
        String updateNote,
        String createdByName,
        Instant createdAt
) {
}
