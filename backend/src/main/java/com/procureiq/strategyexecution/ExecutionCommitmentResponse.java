package com.procureiq.strategyexecution;

import com.procureiq.strategycockpit.BoardDimensionKey;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ExecutionCommitmentResponse(
        UUID id,
        String commitmentNumber,
        UUID sourceRoadmapId,
        String sourceRoadmapNumber,
        String sourceRoadmapTitle,
        UUID sourceInitiativeId,
        String sourceInitiativeNumber,
        String sourceInitiativeTitle,
        BoardDimensionKey dimensionKey,
        UUID ownerUserId,
        String ownerName,
        String currency,
        int fiscalYear,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        BigDecimal plannedContributionPoints,
        ExecutionCommitmentStatus status,
        BigDecimal progressPct,
        LocalDate forecastEndDate,
        int blockerCount,
        String blockerSummary,
        ExecutionCommitmentHealth health,
        BigDecimal expectedProgressPct,
        BigDecimal scheduleVariancePct,
        BigDecimal reportedContributionPoints,
        BigDecimal validatedContributionPoints,
        BigDecimal valueAtRiskPoints,
        Instant actualStartAt,
        Instant actualCompletedAt,
        Instant cancelledAt
) {
}
