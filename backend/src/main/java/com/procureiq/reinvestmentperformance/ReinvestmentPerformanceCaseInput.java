package com.procureiq.reinvestmentperformance;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record ReinvestmentPerformanceCaseInput(

        @NotNull
        UUID performanceOwnerUserId,

        @Min(1)
        @Max(120)
        int measurementHorizonMonths,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal annualOperatingCostAmount,

        @NotBlank
        @Size(max = 5000)
        String performanceObjective
) {
}
