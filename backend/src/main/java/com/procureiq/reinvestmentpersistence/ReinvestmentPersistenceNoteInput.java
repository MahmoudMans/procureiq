package com.procureiq.reinvestmentpersistence;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReinvestmentPersistenceNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
