package com.procureiq.flywheelallocation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelAllocationNoteInput(
        @NotBlank
        @Size(max = 5000)
        String note
) {
}
