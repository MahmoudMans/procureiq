package com.procureiq.sustainability;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SustainabilityDecisionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
