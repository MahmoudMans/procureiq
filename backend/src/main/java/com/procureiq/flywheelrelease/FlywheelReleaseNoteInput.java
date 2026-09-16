package com.procureiq.flywheelrelease;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelReleaseNoteInput(
        @NotBlank
        @Size(max = 5000)
        String note
) {
}
