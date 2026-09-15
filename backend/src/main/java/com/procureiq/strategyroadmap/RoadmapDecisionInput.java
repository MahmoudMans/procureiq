package com.procureiq.strategyroadmap;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RoadmapDecisionInput(

        @NotBlank
        @Size(max = 3000)
        String note
) {
}
