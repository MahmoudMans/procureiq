package com.procureiq.interventionexecution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InterventionExecutionVerificationInput(

        @NotNull
        InterventionExecutionVerificationDecision decision,

        @NotBlank
        @Size(max = 5000)
        String verificationNote
) {
}
