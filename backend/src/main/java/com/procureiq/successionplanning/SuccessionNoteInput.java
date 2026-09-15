package com.procureiq.successionplanning;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SuccessionNoteInput(

        @NotBlank
        @Size(max = 3000)
        String note
) {
}
