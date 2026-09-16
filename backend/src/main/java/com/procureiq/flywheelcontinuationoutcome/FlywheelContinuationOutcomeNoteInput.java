package com.procureiq.flywheelcontinuationoutcome;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelContinuationOutcomeNoteInput(
        @NotBlank
        @Size(max = 2500)
        String note
) {
}
