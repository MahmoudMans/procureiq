package com.procureiq.capacityplanning;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record CapacityAssignmentInput(

        @NotNull
        UUID userId,

        @NotNull
        @DecimalMin("0.01")
        @DecimalMax("100.00")
        BigDecimal allocationPct
) {
}
