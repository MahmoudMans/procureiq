package com.procureiq.compliance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PolicyWaiverInput(

        @NotBlank
        @Size(max = 3000)
        String rationale
) {
}
