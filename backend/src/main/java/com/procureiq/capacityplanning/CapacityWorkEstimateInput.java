package com.procureiq.capacityplanning;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CapacityWorkEstimateInput(

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        @Min(2000)
        @Max(2200)
        int fiscalYear,

        @NotNull
        CapacitySourceType sourceType,

        @NotNull
        UUID sourceEntityId,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal estimatedEffortHours
) {
}
