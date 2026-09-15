package com.procureiq.capitalflywheel;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CapitalFlywheelReviewInput(

        @NotNull
        CapitalFlywheelReviewDecision decision,

        @NotBlank
        @Size(max = 5000)
        String decisionNote
) {
}
