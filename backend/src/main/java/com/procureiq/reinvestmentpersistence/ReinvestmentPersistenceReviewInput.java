package com.procureiq.reinvestmentpersistence;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReinvestmentPersistenceReviewInput(

        @NotNull
        ReinvestmentPersistenceReviewDecision decision,

        @NotBlank
        @Size(max = 5000)
        String reviewNote
) {
}
