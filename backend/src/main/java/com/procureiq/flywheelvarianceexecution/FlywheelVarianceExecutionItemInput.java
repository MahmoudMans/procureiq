package com.procureiq.flywheelvarianceexecution;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record FlywheelVarianceExecutionItemInput(
        @NotNull
        UUID varianceItemId,

        @NotNull
        @DecimalMin("0.00")
        @Digits(integer = 18, fraction = 2)
        BigDecimal executedAmount,

        @NotNull
        FlywheelVarianceExecutionOutcome outcome,

        @Size(max = 300)
        String evidenceReference,

        @NotNull
        LocalDate evidenceDate,

        @NotBlank
        @Size(max = 5000)
        String evidenceNote
) {
}
