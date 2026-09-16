package com.procureiq.flywheelremediation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record FlywheelResidualRemediationPlanInput(
        @NotNull
        UUID sourceExecutionCaseId,

        @NotBlank
        @Size(max = 240)
        String title,

        @NotBlank
        @Size(max = 2500)
        String remediationObjective
) {
}
