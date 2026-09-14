package com.procureiq.budget;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record BudgetAllocationInput(

        @Min(2000)
        @Max(2200)
        int fiscalYear,

        @NotNull
        BudgetScopeType scopeType,

        UUID departmentId,

        @Size(max = 120)
        String category,

        @Size(min = 3, max = 3)
        String currency,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal budgetAmount,

        @NotNull
        @DecimalMin("1.00")
        @DecimalMax("100.00")
        BigDecimal warningThresholdPercent,

        boolean hardLimit,

        UUID ownerUserId,

        @Size(max = 2000)
        String notes
) {
}
