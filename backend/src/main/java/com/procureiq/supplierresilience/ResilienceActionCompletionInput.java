package com.procureiq.supplierresilience;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResilienceActionCompletionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
