package com.procureiq.governancereview;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record GovernanceDecisionResolutionInput(

        @NotNull
        GovernanceDecisionStatus status,

        @NotBlank
        @Size(max = 3000)
        String note
) {
}
