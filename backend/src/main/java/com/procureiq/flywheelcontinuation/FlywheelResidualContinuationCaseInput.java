package com.procureiq.flywheelcontinuation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record FlywheelResidualContinuationCaseInput(
        @NotNull
        UUID sourceOutcomeCaseId,

        @NotBlank
        @Size(max = 240)
        String title
) {
}
