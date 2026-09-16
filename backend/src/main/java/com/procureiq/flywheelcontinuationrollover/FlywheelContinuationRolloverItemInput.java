package com.procureiq.flywheelcontinuationrollover;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record FlywheelContinuationRolloverItemInput(
        @NotNull
        UUID sourceContinuationOutcomeItemId,

        @NotNull
        LocalDate targetDate,

        @NotBlank
        @Size(max = 2500)
        String rationale
) {
}
