package com.procureiq.categorymanagement;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CategoryStrategyInput(

        @NotBlank
        @Size(max = 180)
        String categoryName,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        @Min(2020)
        @Max(2100)
        int fiscalYear,

        UUID ownerUserId,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal savingsTargetPct,

        @NotBlank
        @Size(max = 4000)
        String objectives
) {
}
