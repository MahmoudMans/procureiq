package com.procureiq.capabilityplanning;

import java.math.BigDecimal;
import java.util.UUID;

public record CapabilityMemberResponse(
        UUID userId,
        String userName,
        String role,
        int assessedSkillCount,
        BigDecimal averageProficiency,
        int assignedWorkItemCount,
        int capabilityGapCount,
        int openDevelopmentActionCount
) {
}
