package com.procureiq.strategicvalue;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StrategicValueNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
