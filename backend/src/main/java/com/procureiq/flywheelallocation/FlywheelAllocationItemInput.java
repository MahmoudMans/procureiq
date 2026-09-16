package com.procureiq.flywheelallocation;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelAllocationItemInput(
        @NotNull
        UUID strategyItemId,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal requestedAllocationAmount
) {
}
