package com.procureiq.portfoliooptimization;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record PortfolioScenarioInput(

        @NotBlank
        @Size(max = 240)
        String name,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        UUID ownerUserId,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal budgetLimit,

        @Min(1)
        @Max(100)
        int maxInitiatives,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal maxAverageRiskScore,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal minTotalTargetSavings,

        boolean allowCriticalPriority,

        @Size(max = 3000)
        String notes
) {
}
