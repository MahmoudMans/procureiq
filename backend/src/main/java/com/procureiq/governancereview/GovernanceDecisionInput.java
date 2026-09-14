package com.procureiq.governancereview;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record GovernanceDecisionInput(

        @NotNull
        GovernanceDecisionType decisionType,

        @NotBlank
        @Size(max = 300)
        String title,

        @NotBlank
        @Size(max = 3000)
        String description,

        UUID decisionOwnerUserId,

        LocalDate dueDate
) {
}
