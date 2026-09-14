package com.procureiq.benefitgovernance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BenefitLeakageResolutionInput(

        @NotNull
        BenefitLeakageStatus status,

        @NotBlank
        @Size(max = 2500)
        String note
) {
}
