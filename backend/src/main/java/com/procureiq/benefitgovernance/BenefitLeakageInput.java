package com.procureiq.benefitgovernance;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record BenefitLeakageInput(

        @NotNull
        BenefitLeakageType leakageType,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal amount,

        @NotBlank
        @Size(max = 2500)
        String description,

        UUID ownerUserId,

        LocalDate dueDate
) {
}
