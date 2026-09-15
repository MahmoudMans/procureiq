package com.procureiq.capitalredeployment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CapitalRedeploymentAuthorizationInput(

        @NotNull
        CapitalRedeploymentAuthorizationDecision decision,

        @NotBlank
        @Size(max = 5000)
        String authorizationNote
) {
}
