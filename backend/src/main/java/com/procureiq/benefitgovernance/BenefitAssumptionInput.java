package com.procureiq.benefitgovernance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record BenefitAssumptionInput(

        @NotNull
        BenefitAssumptionType assumptionType,

        @NotBlank
        @Size(max = 2500)
        String description,

        @NotNull
        BigDecimal financialImpact,

        UUID ownerUserId,

        LocalDate reviewDate
) {
}
