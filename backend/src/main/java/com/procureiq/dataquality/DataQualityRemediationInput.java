package com.procureiq.dataquality;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record DataQualityRemediationInput(

        @NotBlank
        @Size(max = 220)
        String title,

        UUID ownerUserId,

        @NotNull
        LocalDate dueDate
) {
}
