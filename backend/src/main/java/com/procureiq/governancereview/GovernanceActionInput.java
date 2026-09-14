package com.procureiq.governancereview;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record GovernanceActionInput(

        UUID decisionId,

        @NotBlank
        @Size(max = 300)
        String title,

        @Size(max = 2500)
        String description,

        UUID ownerUserId,

        @NotNull
        GovernanceActionPriority priority,

        @NotNull
        LocalDate dueDate
) {
}
