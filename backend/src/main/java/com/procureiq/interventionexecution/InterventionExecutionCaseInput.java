package com.procureiq.interventionexecution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record InterventionExecutionCaseInput(

        @NotNull
        UUID executionOwnerUserId,

        @NotBlank
        @Size(max = 5000)
        String executionObjective
) {
}
