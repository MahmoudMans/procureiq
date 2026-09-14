package com.procureiq.sustainability;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SustainabilityAssessmentInput(

        @NotNull
        UUID supplierId,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal environmentalScore,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal socialScore,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal governanceScore,

        @NotNull
        LocalDate assessmentDate,

        UUID ownerUserId,

        @Size(max = 3000)
        String notes
) {
}
