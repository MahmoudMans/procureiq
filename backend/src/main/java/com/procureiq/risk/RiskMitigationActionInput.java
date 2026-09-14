package com.procureiq.risk;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record RiskMitigationActionInput(

        @NotBlank
        @Size(max = 220)
        String title,

        @Size(max = 2000)
        String description,

        LocalDate dueDate,

        UUID ownerUserId
) {
}
