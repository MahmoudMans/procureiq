package com.procureiq.investmentperformance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record InvestmentPerformanceCaseInput(

        @NotNull
        UUID performanceOwnerUserId,

        @NotBlank
        @Size(max = 5000)
        String performanceObjective
) {
}
