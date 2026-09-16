package com.procureiq.flywheelremediation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelResidualRemediationNoteInput(
        @NotBlank
        @Size(max = 2500)
        String note
) {
}
