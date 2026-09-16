package com.procureiq.flywheelstrategy;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelStrategyPortfolioInput(
        @NotBlank
        @Size(max = 300)
        String title,

        @NotBlank
        @Pattern(regexp = "^[A-Z]{3}$")
        String currency,

        @Min(2000)
        @Max(2200)
        int fiscalYear,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal capitalCapacityAmount,

        @NotNull
        UUID portfolioOwnerUserId,

        @NotBlank
        @Size(max = 5000)
        String strategicObjective
) {
}
