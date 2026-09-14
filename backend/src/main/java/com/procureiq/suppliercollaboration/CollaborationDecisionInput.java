package com.procureiq.suppliercollaboration;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CollaborationDecisionInput(

        @NotBlank
        @Size(max = 2500)
        String note
) {
}
