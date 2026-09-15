package com.procureiq.successionplanning;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record SuccessionCandidateInput(

        @NotNull
        UUID userId,

        @NotBlank
        @Size(max = 3000)
        String rationale,

        LocalDate targetDate
) {
}
