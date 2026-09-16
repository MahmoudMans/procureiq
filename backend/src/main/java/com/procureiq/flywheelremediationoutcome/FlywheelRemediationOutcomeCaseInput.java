package com.procureiq.flywheelremediationoutcome;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record FlywheelRemediationOutcomeCaseInput(
        @NotNull
        UUID sourceRemediationPlanId,

        @NotBlank
        @Size(max = 240)
        String title
) {
}
