package com.procureiq.capitalredeployment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CapitalRedeploymentGateDecisionInput(

        @NotNull
        CapitalRedeploymentGateStatus decision,

        @NotBlank
        @Size(max = 5000)
        String evidenceNote,

        @NotBlank
        @Size(max = 5000)
        String decisionNote
) {
}
