package com.procureiq.capitalredeployment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CapitalRedeploymentGateInput(

        @NotBlank
        @Size(max = 300)
        String title,

        @NotBlank
        @Size(max = 4000)
        String requirement
) {
}
