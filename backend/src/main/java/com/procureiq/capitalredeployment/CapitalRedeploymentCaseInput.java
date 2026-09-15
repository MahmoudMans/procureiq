package com.procureiq.capitalredeployment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CapitalRedeploymentCaseInput(

        @NotNull
        UUID redeploymentOwnerUserId,

        @NotBlank
        @Size(max = 5000)
        String redeploymentObjective
) {
}
