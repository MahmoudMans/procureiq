package com.procureiq.continuousimprovement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record ImprovementActionInput(

        @NotBlank
        @Size(max = 300)
        String title,

        @Size(max = 3000)
        String description,

        UUID ownerUserId,

        @NotNull
        LocalDate dueDate
) {
}
