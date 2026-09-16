package com.procureiq.flywheelvariance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelVarianceNoteInput(
        @NotBlank
        @Size(max = 5000)
        String note
) {
}
