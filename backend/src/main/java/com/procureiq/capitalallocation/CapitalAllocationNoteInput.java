package com.procureiq.capitalallocation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CapitalAllocationNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
