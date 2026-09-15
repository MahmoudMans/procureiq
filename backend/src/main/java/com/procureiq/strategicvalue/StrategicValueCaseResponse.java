package com.procureiq.strategicvalue;

import com.procureiq.outcomepersistence.PersistenceHealth;
import com.procureiq.outcomepersistence.PersistencePlanStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record StrategicValueCaseResponse(
        UUID id,
        String caseNumber,
        UUID persistencePlanId,
        String persistencePlanNumber,
        UUID commitmentId,
        String commitmentNumber,
        UUID roadmapId,
        String roadmapNumber,
        String initiativeNumber,
        String initiativeTitle,
        UUID valueOwnerUserId,
        String valueOwnerName,
        String currency,
        int fiscalYear,

        BigDecimal step53ValidatedContributionPoints,
        BigDecimal persistenceBaselinePoints,
        BigDecimal currentPersistenceValidatedPoints,
        BigDecimal persistencePct,
        BigDecimal persistenceDecayPoints,
        PersistenceHealth persistenceHealth,
        PersistencePlanStatus persistenceStatus,

        BigDecimal investmentCostAmount,
        BigDecimal annualOperatingCostAmount,
        BigDecimal annualizedValueAmount,
        int valueHorizonMonths,
        BigDecimal targetRoiPct,
        BigDecimal targetPaybackMonths,
        String valuationNote,

        BigDecimal baselineHorizonValueAmount,
        BigDecimal durableAnnualValueAmount,
        BigDecimal durableHorizonValueAmount,
        BigDecimal decayedValueAmount,
        BigDecimal operatingCostHorizonAmount,
        BigDecimal totalCostAmount,
        BigDecimal netValueAmount,
        BigDecimal roiPct,
        BigDecimal paybackMonths,
        BigDecimal valueAtRiskAmount,
        StrategicValueHealth valueHealth,

        StrategicValueCaseStatus status,
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
