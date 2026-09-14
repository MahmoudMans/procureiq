package com.procureiq.benefitgovernance;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record BenefitForecastInput(

        @NotNull
        @DecimalMin("0.00")
        BigDecimal forecastSavings,

        LocalDate expectedRealizationDate
) {
}
