package com.procureiq.outcomepersistence;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record PersistenceObservationValidationInput(

        @NotNull
        PersistenceValidationDecision decision,

        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal validatedContributionPoints,

        @NotBlank
        @Size(max = 5000)
        String validationNote
) {
}
