package com.procureiq.suppliercollaboration;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CollaborationActionCompletionInput(

        @NotBlank
        @Size(max = 2500)
        String note
) {
}
