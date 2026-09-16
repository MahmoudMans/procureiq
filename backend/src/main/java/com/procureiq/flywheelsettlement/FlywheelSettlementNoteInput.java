package com.procureiq.flywheelsettlement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FlywheelSettlementNoteInput(
        @NotBlank
        @Size(max = 5000)
        String note
) {
}
