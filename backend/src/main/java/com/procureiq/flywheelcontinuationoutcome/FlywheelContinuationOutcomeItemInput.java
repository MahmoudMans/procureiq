package com.procureiq.flywheelcontinuationoutcome;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelContinuationOutcomeItemInput(
        @NotNull
        UUID sourceContinuationItemId,

        @NotNull
        FlywheelContinuationOutcomeResolutionType resolutionType,

        @NotNull
        BigDecimal observedReductionAmount,

        @NotNull
        LocalDate observedOn,

        @NotBlank
        @Size(max = 500)
        String evidenceReference,

        @NotBlank
        @Size(max = 2500)
        String evidenceNote
) {
}
