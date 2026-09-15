package com.procureiq.capabilityplanning;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record CapabilityDevelopmentActionInput(

        @NotNull
        UUID userId,

        @NotNull
        UUID skillId,

        @NotNull
        CapabilityActionType actionType,

        @NotBlank
        @Size(max = 300)
        String title,

        @Size(max = 3000)
        String description,

        @Min(1)
        @Max(5)
        int targetProficiency,

        @NotNull
        LocalDate dueDate
) {
}
