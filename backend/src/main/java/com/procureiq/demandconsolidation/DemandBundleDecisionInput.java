package com.procureiq.demandconsolidation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DemandBundleDecisionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
