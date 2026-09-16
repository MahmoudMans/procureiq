package com.procureiq.flywheelcontinuationrollover;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record FlywheelContinuationRolloverCaseInput(
        @NotNull
        UUID sourceContinuationOutcomeCaseId
) {
}
