package com.procureiq.capabilityplanning;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CapabilityWorkItemResponse(
        CapabilitySourceType sourceType,
        UUID sourceEntityId,
        String sourceReference,
        String sourceTitle,
        String sourceStatus,
        int assignedMemberCount,
        int requirementCount,
        int criticalGapCount,
        BigDecimal assignedFitPct,
        BigDecimal benchFitPct,
        int benchReadyMemberCount,
        CapabilityReadiness readiness,
        List<WorkCapabilityRequirementResponse> requirements,
        List<UUID> assignedUserIds
) {
}
