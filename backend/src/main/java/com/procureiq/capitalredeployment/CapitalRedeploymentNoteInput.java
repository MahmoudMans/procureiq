package com.procureiq.capitalredeployment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CapitalRedeploymentNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
