package com.procureiq.dataquality;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DataQualityFindingDecisionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
