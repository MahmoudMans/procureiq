package com.procureiq.categorymanagement;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CategoryInitiativeInput(

        @NotNull
        CategoryInitiativeType initiativeType,

        @NotBlank
        @Size(max = 240)
        String title,

        @Size(max = 3000)
        String description,

        @NotNull
        CategoryInitiativePriority priority,

        UUID ownerUserId,

        LocalDate plannedStartDate,

        LocalDate plannedEndDate,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal estimatedValue,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal targetSavings
) {
}
