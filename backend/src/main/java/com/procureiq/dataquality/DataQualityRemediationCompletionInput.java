package com.procureiq.dataquality;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DataQualityRemediationCompletionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
