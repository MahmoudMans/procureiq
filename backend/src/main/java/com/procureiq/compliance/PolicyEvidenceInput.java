package com.procureiq.compliance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PolicyEvidenceInput(

        @NotNull
        PolicyEvidenceType evidenceType,

        @NotBlank
        @Size(max = 3000)
        String content
) {
}
