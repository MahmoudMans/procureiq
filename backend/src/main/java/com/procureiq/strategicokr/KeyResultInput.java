package com.procureiq.strategicokr;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record KeyResultInput(

        @NotBlank
        @Size(max = 300)
        String title,

        @Size(max = 3000)
        String description,

        @NotNull
        KeyResultMetricType metricType,

        @NotNull
        KeyResultDirection direction,

        @NotNull
        KeyResultSourceType sourceType,

        OkrSourceScopeType sourceScopeType,

        String sourceScopeKey,

        @NotNull
        BigDecimal baselineValue,

        @NotNull
        BigDecimal targetValue,

        @NotNull
        @DecimalMin("0.01")
        @DecimalMax("100.00")
        BigDecimal weightPct
) {
}
