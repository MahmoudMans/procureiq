package com.procureiq.capitalrecycling;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CapitalReinvestmentDecisionInput(

        @NotNull
        CapitalReinvestmentDecision decision,

        @NotBlank
        @Size(max = 5000)
        String decisionNote
) {
}
