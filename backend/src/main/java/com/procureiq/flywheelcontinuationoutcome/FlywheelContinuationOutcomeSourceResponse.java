package com.procureiq.flywheelcontinuationoutcome;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelContinuationOutcomeSourceResponse(
        UUID continuationCaseId,
        String continuationNumber,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal sourceResidualAmount,
        int sourceItemCount
) {
}
