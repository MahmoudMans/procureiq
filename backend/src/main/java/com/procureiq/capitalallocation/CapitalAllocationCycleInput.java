package com.procureiq.capitalallocation;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CapitalAllocationCycleInput(

        @NotBlank
        @Size(max = 300)
        String title,

        @NotBlank
        @Pattern(regexp = "^[A-Za-z]{3}$")
        String currency,

        @Min(2000)
        @Max(3000)
        int fiscalYear,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal budgetAmount,

        @NotBlank
        @Size(max = 5000)
        String objective
) {
}
