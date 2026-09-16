package com.procureiq.flywheelcontinuation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record FlywheelResidualContinuationItemInput(
        @NotNull
        UUID sourceOutcomeItemId,

        @NotNull
        FlywheelResidualContinuationAction continuationAction,

        @NotNull
        LocalDate targetDate,

        @NotBlank
        @Size(max = 2500)
        String rationale
) {
}
