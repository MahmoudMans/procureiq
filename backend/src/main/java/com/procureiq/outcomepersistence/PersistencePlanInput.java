package com.procureiq.outcomepersistence;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record PersistencePlanInput(

        @NotNull
        UUID persistenceOwnerUserId,

        @NotNull
        LocalDate observationStartDate,

        @NotNull
        LocalDate observationEndDate,

        @NotNull
        @DecimalMin("1.00")
        @DecimalMax("100.00")
        BigDecimal minimumPersistencePct,

        @NotBlank
        @Size(max = 4000)
        String persistenceObjective
) {
}
