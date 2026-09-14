package com.procureiq.supplierresilience;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record ResilienceActionInput(

        @NotNull
        ResilienceActionType actionType,

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
