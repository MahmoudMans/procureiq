package com.procureiq.reinvestmentpersistence;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ReinvestmentPersistenceValidationInput(

        @NotNull
        ReinvestmentPersistenceValidationDecision decision,

        @DecimalMin("0.00")
        BigDecimal validatedCurrentAnnualizedValueAmount,

        @NotBlank
        @Size(max = 5000)
        String validationNote
) {
}
