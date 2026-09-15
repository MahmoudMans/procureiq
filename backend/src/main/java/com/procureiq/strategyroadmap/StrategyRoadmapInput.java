package com.procureiq.strategyroadmap;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record StrategyRoadmapInput(

        @NotNull
        UUID approvedScenarioId,

        @NotBlank
        @Size(max = 300)
        String title,

        @NotBlank
        @Size(max = 4000)
        String objective,

        @NotNull
        LocalDate startDate,

        @NotNull
        LocalDate targetEndDate
) {
}
