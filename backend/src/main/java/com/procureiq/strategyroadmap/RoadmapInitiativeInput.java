package com.procureiq.strategyroadmap;

import com.procureiq.strategycockpit.BoardDimensionKey;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record RoadmapInitiativeInput(

        @NotBlank
        @Size(max = 300)
        String title,

        @Size(max = 4000)
        String description,

        @NotNull
        BoardDimensionKey dimensionKey,

        @NotNull
        RoadmapPriority priority,

        @NotNull
        UUID ownerUserId,

        @NotNull
        LocalDate plannedStartDate,

        @NotNull
        LocalDate plannedEndDate,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal plannedContributionPoints
) {
}
