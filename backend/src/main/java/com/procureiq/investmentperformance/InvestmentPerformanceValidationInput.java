package com.procureiq.investmentperformance;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record InvestmentPerformanceValidationInput(

        @NotNull
        InvestmentPerformanceValidationDecision decision,

        @DecimalMin("0.00")
        BigDecimal validatedRealizedAnnualizedValueAmount,

        @NotBlank
        @Size(max = 5000)
        String validationNote
) {
}
