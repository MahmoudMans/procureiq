package com.procureiq.strategyroadmap;

import java.time.LocalDate;
import java.util.UUID;

public record RoadmapMilestoneResponse(
        UUID id,
        UUID initiativeId,
        String title,
        String description,
        LocalDate dueDate,
        RoadmapMilestoneStatus status,
        boolean overdue
) {
}
