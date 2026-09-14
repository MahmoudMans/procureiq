package com.procureiq.strategicokr;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record StrategicObjectiveInput(

        @NotBlank
        @Size(max = 300)
        String title,

        @NotBlank
        @Size(max = 5000)
        String description,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        @NotNull
        StrategicObjectivePeriodType periodType,

        @Min(2000)
        @Max(2200)
        int fiscalYear,

        Integer quarter,

        @NotNull
        LocalDate startDate,

        @NotNull
        LocalDate endDate,

        UUID ownerUserId
) {
}
