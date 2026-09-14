package com.procureiq.benefitgovernance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BenefitResolutionInput(

        @NotBlank
        @Size(max = 2500)
        String note
) {
}
