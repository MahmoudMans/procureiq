package com.procureiq.outcomepersistence;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PersistenceObservationInput(

        @NotNull
        LocalDate observedOn,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal reportedContributionPoints,

        @NotBlank
        @Size(max = 5000)
        String evidenceNote
) {
}
