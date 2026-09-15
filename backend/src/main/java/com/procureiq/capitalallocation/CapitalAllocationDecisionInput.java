package com.procureiq.capitalallocation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CapitalAllocationDecisionInput(

        @NotNull
        CapitalAllocationDecision decision,

        @NotBlank
        @Size(max = 5000)
        String decisionNote
) {
}
