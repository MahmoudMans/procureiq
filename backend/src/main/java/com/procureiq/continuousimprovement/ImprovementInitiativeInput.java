package com.procureiq.continuousimprovement;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ImprovementInitiativeInput(

        @NotBlank
        @Size(max = 260)
        String title,

        @NotBlank
        @Size(max = 4000)
        String description,

        @NotNull
        UUID sourceSnapshotId,

        @NotNull
        ImprovementScopeType scopeType,

        String scopeKey,

        UUID ownerUserId,

        @NotNull
        ImprovementPriority priority,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal targetSlaAttainmentPct,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal targetSlaOverdueReductionPct,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal targetPersistentReductionPct,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal targetResolutionHoursReductionPct,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal targetExposureReductionPct,

        @NotNull
        LocalDate targetDate,

        @Size(max = 3000)
        String notes
) {
}
