package com.procureiq.strategyscenario;

import com.procureiq.strategycockpit.BoardDimensionKey;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record StrategyScenarioAssumptionInput(

        @NotNull
        BoardDimensionKey dimensionKey,

        @NotNull
        @DecimalMin("-100.00")
        @DecimalMax("100.00")
        BigDecimal adjustmentPoints,

        @NotBlank
        @Size(max = 3000)
        String rationale
) {
}
