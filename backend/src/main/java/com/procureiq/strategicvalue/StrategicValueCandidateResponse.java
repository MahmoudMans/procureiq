package com.procureiq.strategicvalue;

import com.procureiq.outcomepersistence.PersistenceHealth;
import com.procureiq.outcomepersistence.PersistencePlanStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record StrategicValueCandidateResponse(
        UUID persistencePlanId,
        String persistencePlanNumber,
        UUID commitmentId,
        String commitmentNumber,
        UUID roadmapId,
        String roadmapNumber,
        String initiativeNumber,
        String initiativeTitle,
        String executionOwnerName,
        String persistenceOwnerName,
        String currency,
        int fiscalYear,
        BigDecimal step53ValidatedContributionPoints,
        BigDecimal persistenceBaselinePoints,
        BigDecimal currentPersistenceValidatedPoints,
        BigDecimal persistencePct,
        BigDecimal decayPoints,
        PersistenceHealth persistenceHealth,
        PersistencePlanStatus persistenceStatus
) {
}
