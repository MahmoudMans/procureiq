package com.procureiq.strategyrecovery;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record RecoveryActionInput(

        @NotBlank
        @Size(max = 300)
        String title,

        @Size(max = 4000)
        String description,

        @NotNull
        UUID ownerUserId,

        @NotNull
        LocalDate dueDate
) {
}
