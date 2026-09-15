package com.procureiq.strategyroadmap;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record RoadmapMilestoneInput(

        @NotBlank
        @Size(max = 300)
        String title,

        @Size(max = 3000)
        String description,

        @NotNull
        LocalDate dueDate
) {
}
