package com.procureiq.investmentperformance;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record InvestmentPerformanceObservationInput(

        @NotNull
        LocalDate observedOn,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal reportedRealizedAnnualizedValueAmount,

        @NotBlank
        @Size(max = 5000)
        String evidenceNote
) {
}
