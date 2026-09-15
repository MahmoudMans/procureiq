package com.procureiq.strategyscenario;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StrategyScenarioInput(

        @NotBlank
        @Size(max = 300)
        String name,

        @Size(max = 4000)
        String description,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        @Min(2000)
        @Max(2200)
        int fiscalYear
) {
}
