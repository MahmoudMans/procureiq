package com.procureiq.flywheelallocation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record FlywheelAllocationMandateInput(
        @NotNull
        UUID strategyPortfolioId,

        @NotBlank
        @Size(max = 300)
        String title,

        @NotNull
        UUID mandateOwnerUserId,

        @NotBlank
        @Size(max = 5000)
        String mandateRationale
) {
}
