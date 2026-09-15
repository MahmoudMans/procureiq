package com.procureiq.investmentperformance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InvestmentPerformanceReviewInput(

        @NotNull
        InvestmentPerformanceReviewDecision decision,

        @NotBlank
        @Size(max = 5000)
        String decisionNote
) {
}
