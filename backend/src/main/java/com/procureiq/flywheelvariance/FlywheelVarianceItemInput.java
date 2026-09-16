package com.procureiq.flywheelvariance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record FlywheelVarianceItemInput(
        @NotNull
        UUID settlementItemId,

        @NotNull
        FlywheelVarianceDecision decision,

        @NotBlank
        @Size(max = 5000)
        String decisionRationale,

        @NotNull
        LocalDate targetDate
) {
}
