package com.procureiq.executive;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ExecutiveWarningAcknowledgeInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
