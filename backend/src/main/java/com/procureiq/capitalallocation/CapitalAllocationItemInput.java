package com.procureiq.capitalallocation;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record CapitalAllocationItemInput(

        @NotNull
        UUID valueCaseId,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal requestedCapitalAmount
) {
}
