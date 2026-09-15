package com.procureiq.reinvestmentperformance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReinvestmentPerformanceReviewInput(

        @NotNull
        ReinvestmentPerformanceReviewDecision decision,

        @NotBlank
        @Size(max = 5000)
        String reviewNote
) {
}
