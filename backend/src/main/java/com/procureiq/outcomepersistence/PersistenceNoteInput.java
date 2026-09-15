package com.procureiq.outcomepersistence;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PersistenceNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
