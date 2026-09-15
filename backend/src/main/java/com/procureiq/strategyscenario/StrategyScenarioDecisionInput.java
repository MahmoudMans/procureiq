package com.procureiq.strategyscenario;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StrategyScenarioDecisionInput(

        @NotBlank
        @Size(max = 4000)
        String note
) {
}
