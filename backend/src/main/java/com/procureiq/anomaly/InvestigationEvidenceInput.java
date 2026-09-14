package com.procureiq.anomaly;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InvestigationEvidenceInput(

        @NotNull
        InvestigationEvidenceType evidenceType,

        @NotBlank
        @Size(max = 3000)
        String referenceText
) {
}
