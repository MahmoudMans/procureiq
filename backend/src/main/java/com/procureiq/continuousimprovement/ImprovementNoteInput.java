package com.procureiq.continuousimprovement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ImprovementNoteInput(

        @NotBlank
        @Size(max = 3000)
        String note
) {
}
