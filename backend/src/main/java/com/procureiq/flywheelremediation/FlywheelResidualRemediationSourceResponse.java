package com.procureiq.flywheelremediation;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelResidualRemediationSourceResponse(
        UUID executionCaseId,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal financialResidualAmount,
        int residualItemCount
) {
}
