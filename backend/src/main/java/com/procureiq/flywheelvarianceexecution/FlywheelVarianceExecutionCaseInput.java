package com.procureiq.flywheelvarianceexecution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record FlywheelVarianceExecutionCaseInput(
        @NotNull
        UUID variancePlanId,

        @NotBlank
        @Size(max = 300)
        String title,

        @NotNull
        UUID executionOwnerUserId,

        @NotBlank
        @Size(max = 5000)
        String executionObjective
) {
}
