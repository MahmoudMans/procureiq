package com.procureiq.flywheelcontinuation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelResidualContinuationNoteInput(
        @NotBlank
        @Size(max = 2500)
        String note
) {
}
