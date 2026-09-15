package com.procureiq.strategyrecovery;

import com.procureiq.strategyexecution.ExecutionCommitmentHealth;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record RecoveryCandidateResponse(
        UUID commitmentId,
        String commitmentNumber,
        UUID roadmapId,
        String roadmapNumber,
        String initiativeNumber,
        String initiativeTitle,
        String ownerName,
        ExecutionCommitmentHealth executionHealth,
        BigDecimal progressPct,
        LocalDate plannedEndDate,
        LocalDate forecastEndDate,
        int blockerCount,
        BigDecimal plannedContributionPoints,
        BigDecimal validatedContributionPoints,
        BigDecimal valueAtRiskPoints,
        BigDecimal riskScore,
        RecoverySeverity severity
) {
}
