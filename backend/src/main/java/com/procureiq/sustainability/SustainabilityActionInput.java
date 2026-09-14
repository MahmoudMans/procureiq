package com.procureiq.sustainability;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record SustainabilityActionInput(

        @NotNull
        SustainabilityActionType actionType,

        @NotBlank
        @Size(max = 220)
        String title,

        @Size(max = 2000)
        String description,

        UUID ownerUserId,

        @NotNull
        LocalDate dueDate
) {
}
