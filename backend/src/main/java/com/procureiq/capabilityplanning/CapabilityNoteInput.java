package com.procureiq.capabilityplanning;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CapabilityNoteInput(

        @NotBlank
        @Size(max = 3000)
        String note
) {
}
