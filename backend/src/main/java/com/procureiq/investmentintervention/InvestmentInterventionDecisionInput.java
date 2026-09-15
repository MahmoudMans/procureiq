package com.procureiq.investmentintervention;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InvestmentInterventionDecisionInput(

        @NotNull
        InvestmentInterventionDecision decision,

        @NotBlank
        @Size(max = 5000)
        String decisionNote
) {
}
