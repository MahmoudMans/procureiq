package com.procureiq.commercialgovernance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ContractObligationCompletionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
