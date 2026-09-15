package com.procureiq.capitalrecycling;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CapitalReinvestmentProposalInput(

        @NotNull
        UUID targetValueCaseId,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal requestedReinvestmentAmount,

        @NotBlank
        @Size(max = 5000)
        String proposalRationale
) {
}
