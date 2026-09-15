package com.procureiq.interventionexecution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InterventionExecutionNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
