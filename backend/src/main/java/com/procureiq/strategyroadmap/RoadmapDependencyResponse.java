package com.procureiq.strategyroadmap;

import java.util.UUID;

public record RoadmapDependencyResponse(
        UUID id,
        UUID predecessorInitiativeId,
        String predecessorNumber,
        String predecessorTitle,
        RoadmapInitiativeStatus predecessorStatus,
        UUID successorInitiativeId,
        String successorNumber,
        String successorTitle,
        RoadmapInitiativeStatus successorStatus,
        RoadmapDependencyType dependencyType,
        String rationale,
        boolean satisfied
) {
}
