package com.procureiq.flywheelcontinuationrollover;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelContinuationRolloverNoteInput(
        @NotBlank
        @Size(max = 2500)
        String note
) {
}
