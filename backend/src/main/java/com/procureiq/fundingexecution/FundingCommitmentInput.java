package com.procureiq.fundingexecution;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record FundingCommitmentInput(

        @NotNull
        UUID fundingOwnerUserId,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal committedCapitalAmount,

        @NotBlank
        @Size(max = 5000)
        String objective
) {
}
