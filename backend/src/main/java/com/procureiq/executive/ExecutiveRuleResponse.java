package com.procureiq.executive;

import java.math.BigDecimal;

public record ExecutiveRuleResponse(
        long id,
        String ruleCode,
        ExecutiveSignalType signalType,
        ExecutiveSignalNature nature,
        String title,
        String description,
        String recommendation,
        ExecutiveWarningSeverity defaultSeverity,
        BigDecimal thresholdValue,
        int lookaheadDays,
        boolean enabled,
        int priority
) {
}
