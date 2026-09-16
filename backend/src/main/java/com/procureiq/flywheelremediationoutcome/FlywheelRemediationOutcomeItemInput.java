package com.procureiq.flywheelremediationoutcome;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelRemediationOutcomeItemInput(
        @NotNull
        UUID sourceRemediationItemId,

        @NotNull
        FlywheelRemediationResolutionType resolutionType,

        @NotNull
        @DecimalMin("0.00")
        @Digits(integer = 18, fraction = 2)
        BigDecimal resolvedAmount,

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
