package com.procureiq.successionplanning;

import com.procureiq.capacityplanning.CapacityUserOptionResponse;
import com.procureiq.capabilityplanning.CapabilitySkillResponse;

import java.util.List;

public record SuccessionPlanningDashboardResponse(
        String currency,
        int fiscalYear,
        SuccessionSummaryResponse summary,
        List<CapacityUserOptionResponse> users,
        List<CapabilitySkillResponse> skills,
        List<SuccessionPolicyResponse> policies,
        List<SuccessionSnapshotSummaryResponse> snapshots
) {
}
