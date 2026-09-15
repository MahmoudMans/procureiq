package com.procureiq.reinvestmentperformance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReinvestmentPerformanceNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
