package com.procureiq.capitalrecycling;

import com.procureiq.strategicvalue.StrategicValueHealth;

import java.math.BigDecimal;
import java.util.UUID;

public record CapitalReinvestmentTargetResponse(
        UUID valueCaseId,
        String valueCaseNumber,
        String initiativeNumber,
        String initiativeTitle,
        String currency,
        int fiscalYear,
        BigDecimal roiPct,
        BigDecimal persistencePct,
        BigDecimal netValueAmount,
        StrategicValueHealth valueHealth,
        boolean preferredTarget
) {
}
