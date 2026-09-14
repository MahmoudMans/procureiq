package com.procureiq.anomaly;

import java.math.BigDecimal;

public record AnomalyRuleResponse(
        long id,
        String ruleCode,
        AnomalySignalType signalType,
        String title,
        String description,
        AnomalySeverity defaultSeverity,
        BigDecimal scoreWeight,
        BigDecimal thresholdValue,
        int lookbackDays,
        boolean enabled,
        long activeFindings
) {
}
