package com.procureiq.flywheelstrategy;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelStrategyItemInput(
        @NotNull
        UUID flywheelLineageId,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal proposedCapacityAmount
) {
}
