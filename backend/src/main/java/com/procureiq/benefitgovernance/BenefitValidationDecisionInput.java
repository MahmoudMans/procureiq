package com.procureiq.benefitgovernance;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record BenefitValidationDecisionInput(

        @NotNull
        @DecimalMin("0.00")
        BigDecimal validatedSavings,

        @NotBlank
        @Size(max = 2500)
        String note
) {
}
