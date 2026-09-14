package com.procureiq.strategicokr;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record OkrContributionInput(

        @NotNull
        UUID improvementInitiativeId,

        @NotNull
        @DecimalMin("0.01")
        @DecimalMax("100.00")
        BigDecimal contributionWeightPct,

        @NotBlank
        @Size(max = 2500)
        String rationale
) {
}
