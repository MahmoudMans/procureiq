package com.procureiq.reinvestmentpersistence;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record ReinvestmentPersistenceCaseInput(

        @NotNull
        UUID persistenceOwnerUserId,

        @Min(0)
        @Max(36)
        int persistenceObservationWindowMonths,

        @NotNull
        @DecimalMin("50.00")
        @DecimalMax("100.00")
        BigDecimal minimumValuePersistencePct,

        @NotNull
        @DecimalMin("50.00")
        @DecimalMax("100.00")
        BigDecimal minimumEfficiencyRetentionPct,

        @NotBlank
        @Size(max = 5000)
        String persistenceObjective
) {
}
