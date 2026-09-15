package com.procureiq.strategyrecovery;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RecoveryNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
