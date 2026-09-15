package com.procureiq.outcomepersistence;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PersistenceVerificationInput(

        @NotNull
        PersistenceVerificationDecision decision,

        @NotBlank
        @Size(max = 5000)
        String verificationNote
) {
}
