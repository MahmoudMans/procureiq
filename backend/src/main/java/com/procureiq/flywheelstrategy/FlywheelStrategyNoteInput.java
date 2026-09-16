package com.procureiq.flywheelstrategy;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelStrategyNoteInput(
        @NotBlank
        @Size(max = 5000)
        String note
) {
}
