package com.procureiq.flywheelstrategy;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record FlywheelStrategyDecisionInput(
        @NotNull
        FlywheelStrategyDecision decision,

        @NotBlank
        @Size(max = 5000)
        String decisionNote
) {
}
