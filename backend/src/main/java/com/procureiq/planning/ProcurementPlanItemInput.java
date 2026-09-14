package com.procureiq.planning;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ProcurementPlanItemInput(

        @NotBlank
        @Size(max = 220)
        String title,

        @Size(max = 2000)
        String description,

        @NotNull
        UUID departmentId,

        @NotBlank
        @Size(max = 120)
        String category,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal plannedValue,

        @NotNull
        LocalDate targetSourcingDate,

        @NotNull
        ProcurementPlanPriority priority,

        @Size(max = 2000)
        String notes
) {
}
