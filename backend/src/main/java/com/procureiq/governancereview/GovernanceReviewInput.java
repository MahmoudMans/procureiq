package com.procureiq.governancereview;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record GovernanceReviewInput(

        @NotBlank
        @Size(max = 240)
        String title,

        @NotNull
        LocalDate periodStart,

        @NotNull
        LocalDate periodEnd,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        UUID ownerUserId,

        UUID chairUserId,

        @NotBlank
        @Size(max = 5000)
        String executiveSummary
) {
}
