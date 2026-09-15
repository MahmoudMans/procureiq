package com.procureiq.strategicvalue;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record StrategicValueCaseInput(

        @NotNull
        UUID valueOwnerUserId,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal investmentCostAmount,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal annualOperatingCostAmount,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal annualizedValueAmount,

        @Min(1)
        @Max(600)
        int valueHorizonMonths,

        @NotNull
        @DecimalMin("-100.00")
        @DecimalMax("10000.00")
        BigDecimal targetRoiPct,

        @NotNull
        @DecimalMin("1.00")
        @DecimalMax("600.00")
        BigDecimal targetPaybackMonths,

        @NotBlank
        @Size(max = 5000)
        String valuationNote
) {
}
