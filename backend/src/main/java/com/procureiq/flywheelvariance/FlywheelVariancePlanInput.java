package com.procureiq.flywheelvariance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record FlywheelVariancePlanInput(
        @NotNull
        UUID settlementCaseId,

        @NotBlank
        @Size(max = 300)
        String title,

        @NotNull
        UUID planOwnerUserId,

        @NotBlank
        @Size(max = 5000)
        String resolutionObjective
) {
}
