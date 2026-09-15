package com.procureiq.fundingexecution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record FundingGateDecisionInput(

        @NotNull
        FundingGateStatus decision,

        @NotBlank
        @Size(max = 5000)
        String evidenceNote,

        @NotBlank
        @Size(max = 5000)
        String decisionNote
) {
}
