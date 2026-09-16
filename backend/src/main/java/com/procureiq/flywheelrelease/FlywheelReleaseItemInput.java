package com.procureiq.flywheelrelease;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record FlywheelReleaseItemInput(
        @NotNull
        UUID allocationItemId,

        @NotNull
        @DecimalMin("0.01")
        @Digits(integer = 18, fraction = 2)
        BigDecimal plannedReleaseAmount
) {
}
