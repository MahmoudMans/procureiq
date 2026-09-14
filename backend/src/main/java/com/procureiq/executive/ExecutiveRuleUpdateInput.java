package com.procureiq.executive;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ExecutiveRuleUpdateInput(

        boolean enabled,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal thresholdValue,

        @Min(0)
        @Max(1095)
        int lookaheadDays,

        @NotNull
        ExecutiveWarningSeverity defaultSeverity
) {
}
