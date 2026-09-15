package com.procureiq.capitalrecycling;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CapitalRecyclingNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
