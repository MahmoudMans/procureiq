package com.procureiq.strategyroadmap;

import com.procureiq.strategycockpit.BoardDimensionKey;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record RoadmapInitiativeResponse(
        UUID id,
        String initiativeNumber,
        String title,
        String description,
        BoardDimensionKey dimensionKey,
        RoadmapPriority priority,
        UUID ownerUserId,
        String ownerName,
        String ownerRole,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        BigDecimal plannedContributionPoints,
        RoadmapInitiativeStatus status,
        int blockedDependencyCount,
        int overdueMilestoneCount,
        int pendingGateCount,
        int rejectedGateCount,
        boolean blocked
) {
}
