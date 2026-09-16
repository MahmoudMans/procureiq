package com.procureiq.flywheelrelease;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelReleaseExecutionInput(
        @NotBlank
        @Size(max = 300)
        String executionReference,

        @NotBlank
        @Size(max = 5000)
        String executionNote
) {
}
