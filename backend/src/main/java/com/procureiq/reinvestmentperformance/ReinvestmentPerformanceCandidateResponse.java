package com.procureiq.reinvestmentperformance;

import com.procureiq.capitalredeployment.CapitalRedeploymentStatus;
import com.procureiq.strategicvalue.StrategicValueHealth;

import java.math.BigDecimal;
import java.util.UUID;

public record ReinvestmentPerformanceCandidateResponse(
        UUID redeploymentCaseId,
        String redeploymentNumber,
        CapitalRedeploymentStatus redeploymentStatus,

        UUID recyclingSourceId,
        String recyclingSourceNumber,

        UUID targetValueCaseId,
        String targetValueCaseNumber,
        String targetInitiativeNumber,
        String targetInitiativeTitle,

        String currency,
        int fiscalYear,

        BigDecimal redeployedCapitalAmount,
        BigDecimal baselineTargetRoiPct,
        BigDecimal baselineTargetPersistencePct,
        BigDecimal baselineTargetNetValueAmount,
        StrategicValueHealth targetValueHealth
) {
}
