package com.procureiq.interventionexecution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InterventionExecutionAcknowledgementInput(

        @NotBlank
        @Size(max = 5000)
        String acknowledgementNote
) {
}
