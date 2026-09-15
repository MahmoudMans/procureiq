package com.procureiq.strategicalignment;

import com.procureiq.strategicokr.StrategicHealth;
import com.procureiq.strategicokr.StrategicObjectiveStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ObjectiveAlignmentSummaryResponse(
        UUID id,
        String objectiveNumber,
        String title,
        StrategicObjectiveStatus status,
        LocalDate endDate,
        String ownerName,
        BigDecimal okrProgressPct,
        StrategicHealth okrHealth,
        int linkedSourceCount,
        BigDecimal allocatedStrategicValue,
        BigDecimal coveredRiskExposure,
        int deadlineConflictCount
) {
}
