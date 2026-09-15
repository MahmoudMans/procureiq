package com.procureiq.capitalflywheel;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CapitalFlywheelNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
