package com.procureiq.flywheelcontinuation;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelResidualContinuationSourceResponse(
        UUID outcomeCaseId,
        String outcomeNumber,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal remainingResidualAmount,
        int residualItemCount
) {
}
