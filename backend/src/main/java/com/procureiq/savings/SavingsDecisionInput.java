package com.procureiq.savings;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SavingsDecisionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
