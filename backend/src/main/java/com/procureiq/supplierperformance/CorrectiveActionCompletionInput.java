package com.procureiq.supplierperformance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CorrectiveActionCompletionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
