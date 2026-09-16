package com.procureiq.flywheelremediationoutcome;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelRemediationOutcomeSourceResponse(
        UUID remediationPlanId,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal residualAmount,
        int itemCount
) {
}
