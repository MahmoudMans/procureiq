package com.procureiq.strategyroadmap;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record RoadmapGateInput(

        @NotBlank
        @Size(max = 300)
        String gateName,

        @NotNull
        LocalDate dueDate
) {
}
