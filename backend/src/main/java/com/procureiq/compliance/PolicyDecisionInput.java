package com.procureiq.compliance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PolicyDecisionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
