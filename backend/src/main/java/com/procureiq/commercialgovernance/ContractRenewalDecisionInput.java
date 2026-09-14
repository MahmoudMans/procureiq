package com.procureiq.commercialgovernance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ContractRenewalDecisionInput(

        @NotNull
        ContractRenewalDecision decision,

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
