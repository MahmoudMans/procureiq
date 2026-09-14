package com.procureiq.commercialgovernance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CommercialLeakageDecisionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
