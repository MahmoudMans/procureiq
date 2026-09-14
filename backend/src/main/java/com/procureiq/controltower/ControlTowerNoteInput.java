package com.procureiq.controltower;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ControlTowerNoteInput(

        @NotBlank
        @Size(max = 2500)
        String note
) {
}
