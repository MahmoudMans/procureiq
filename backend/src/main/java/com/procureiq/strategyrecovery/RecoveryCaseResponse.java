package com.procureiq.strategyrecovery;

import com.procureiq.strategyexecution.ExecutionCommitmentHealth;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record RecoveryCaseResponse(
        UUID id,
        String recoveryNumber,
        UUID commitmentId,
        String commitmentNumber,
        UUID roadmapId,
        String roadmapNumber,
        String initiativeNumber,
        String initiativeTitle,
        String executionOwnerName,
        UUID recoveryOwnerUserId,
        String recoveryOwnerName,
        RecoverySeverity severity,
        RecoveryCaseStatus status,
        String recoveryObjective,
        LocalDate targetRecoveryDate,

        ExecutionCommitmentHealth baselineExecutionHealth,
        BigDecimal baselineProgressPct,
        LocalDate baselineForecastEndDate,
        int baselineBlockerCount,
        BigDecimal baselinePlannedContributionPoints,
        BigDecimal baselineValidatedContributionPoints,
        BigDecimal baselineValueAtRiskPoints,
        BigDecimal baselineRiskScore,

        ExecutionCommitmentHealth currentExecutionHealth,
        BigDecimal currentProgressPct,
        LocalDate currentForecastEndDate,
        int currentBlockerCount,
        BigDecimal currentValidatedContributionPoints,
        BigDecimal currentValueAtRiskPoints,
        BigDecimal currentRiskScore,
        BigDecimal recoveryScore,
        BigDecimal effectivenessPct,
        RecoveryHealth recoveryHealth,
        boolean verificationEligible,

        int openActionCount,
        int overdueActionCount,
        int escalationCount,

        String verificationNote,
        String verifiedByName,
        Instant verifiedAt,
        String closeNote,
        String closedByName,
        Instant closedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
