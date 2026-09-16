package com.procureiq.flywheelcontinuationoutcome;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record FlywheelContinuationOutcomeCaseInput(
        @NotNull
        UUID sourceContinuationCaseId
) {
}
