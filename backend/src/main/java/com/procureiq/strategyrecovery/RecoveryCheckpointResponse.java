package com.procureiq.strategyrecovery;

import com.procureiq.strategyexecution.ExecutionCommitmentHealth;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record RecoveryCheckpointResponse(
        UUID id,
        UUID recoveryCaseId,
        ExecutionCommitmentHealth executionHealth,
        BigDecimal progressPct,
        LocalDate forecastEndDate,
        int blockerCount,
        BigDecimal validatedContributionPoints,
        BigDecimal valueAtRiskPoints,
        BigDecimal currentRiskScore,
        BigDecimal recoveryScore,
        BigDecimal effectivenessPct,
        RecoveryHealth recoveryHealth,
        String checkpointNote,
        String capturedByName,
        Instant capturedAt
) {
}
