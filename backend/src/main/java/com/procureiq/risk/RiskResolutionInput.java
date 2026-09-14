package com.procureiq.risk;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RiskResolutionInput(

        @NotBlank
        @Size(max = 3000)
        String note
) {
}
