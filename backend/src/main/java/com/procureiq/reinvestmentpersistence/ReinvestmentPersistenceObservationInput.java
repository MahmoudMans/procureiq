package com.procureiq.reinvestmentpersistence;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ReinvestmentPersistenceObservationInput(

        @NotNull
        LocalDate observedOn,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal reportedCurrentAnnualizedValueAmount,

        @NotBlank
        @Size(max = 5000)
        String evidenceNote
) {
}
