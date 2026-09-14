package com.procureiq.supplieronboarding;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record OnboardingDecisionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
