package com.procureiq.flywheelcontinuationrollover;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelContinuationRolloverSourceResponse(
        UUID continuationOutcomeCaseId,
        String continuationOutcomeNumber,
        UUID parentContinuationCaseId,
        String parentContinuationNumber,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal remainingResidualAmount,
        int positiveResidualItemCount
) {
}
