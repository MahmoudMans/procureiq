package com.procureiq.sustainability;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SustainabilityActionCompletionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
