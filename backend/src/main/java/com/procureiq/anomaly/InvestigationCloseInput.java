package com.procureiq.anomaly;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InvestigationCloseInput(

        @NotNull
        InvestigationDisposition disposition,

        @NotBlank
        @Size(max = 3000)
        String note
) {
}
