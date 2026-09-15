package com.procureiq.capitalflywheel;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CapitalFlywheelLineageInput(

        @NotNull
        UUID lineageOwnerUserId,

        @Min(1)
        @Max(20)
        int maximumCycleCount,

        @NotNull
        @DecimalMin("0.0000")
        @DecimalMax("10.0000")
        BigDecimal minimumMarginalValueMultiple,

        @NotNull
        @DecimalMin("50.00")
        @DecimalMax("200.00")
        BigDecimal minimumCycleEfficiencyRetentionPct,

        @NotNull
        @DecimalMin("10.00")
        @DecimalMax("100.00")
        BigDecimal diminishingReturnTolerancePct,

        @NotBlank
        @Size(max = 5000)
        String lineageObjective
) {
}
