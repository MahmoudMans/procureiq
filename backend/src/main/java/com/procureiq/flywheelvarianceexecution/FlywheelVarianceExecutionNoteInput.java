package com.procureiq.flywheelvarianceexecution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelVarianceExecutionNoteInput(
        @NotBlank
        @Size(max = 5000)
        String note
) {
}
