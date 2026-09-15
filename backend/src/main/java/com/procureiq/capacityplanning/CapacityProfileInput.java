package com.procureiq.capacityplanning;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CapacityProfileInput(

        @NotNull
        @DecimalMin("0.00")
        BigDecimal annualCapacityHours,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal reservedOperationalPct,

        @Size(max = 3000)
        String notes
) {
}
