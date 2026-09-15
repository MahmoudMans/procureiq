package com.procureiq.strategyroadmap;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record RoadmapDependencyInput(

        @NotNull
        UUID predecessorInitiativeId,

        @NotNull
        UUID successorInitiativeId,

        @NotNull
        RoadmapDependencyType dependencyType,

        @Size(max = 3000)
        String rationale
) {
}
