package com.procureiq.negotiation;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record NegotiationScenarioInput(

        @NotBlank
        @Size(max = 220)
        String name,

        @NotNull
        NegotiationScenarioType scenarioType,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal totalValue,

        @Min(0)
        int paymentTermsDays,

        @Min(0)
        int leadTimeDays,

        @Min(0)
        int warrantyMonths,

        @Min(0)
        Integer volumeCommitment,

        boolean preferred,

        @Size(max = 3000)
        String notes
) {
}
