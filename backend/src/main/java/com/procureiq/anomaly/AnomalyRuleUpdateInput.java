package com.procureiq.anomaly;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record AnomalyRuleUpdateInput(

        boolean enabled,

        @NotNull
        AnomalySeverity defaultSeverity,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal scoreWeight,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal thresholdValue,

        @Min(1)
        @Max(3650)
        int lookbackDays
) {
}
