package com.procureiq.investmentperformance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InvestmentPerformanceNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
