package com.procureiq.flywheelremediationoutcome;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelRemediationOutcomeNoteInput(
        @NotBlank
        @Size(max = 2500)
        String note
) {
}
