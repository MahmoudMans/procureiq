package com.procureiq.supplieronboarding;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record OnboardingEvidenceInput(

        @NotBlank
        @Size(max = 500)
        String documentReference,

        LocalDate expiryDate
) {
}
