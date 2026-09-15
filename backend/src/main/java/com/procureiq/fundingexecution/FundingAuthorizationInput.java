package com.procureiq.fundingexecution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record FundingAuthorizationInput(

        @NotNull
        FundingAuthorizationDecision decision,

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
