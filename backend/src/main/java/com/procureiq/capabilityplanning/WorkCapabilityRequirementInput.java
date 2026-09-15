package com.procureiq.capabilityplanning;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record WorkCapabilityRequirementInput(

        @NotNull
        UUID skillId,

        @Min(1)
        @Max(5)
        int requiredProficiency,

        @NotNull
        @DecimalMin("0.01")
        @DecimalMax("100.00")
        BigDecimal importanceWeightPct
) {
}
