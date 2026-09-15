package com.procureiq.capabilityplanning;

import com.procureiq.capacityplanning.CapacityUserOptionResponse;

import java.util.List;

public record CapabilityPlanningDashboardResponse(
        String currency,
        int fiscalYear,
        CapabilitySummaryResponse summary,
        List<CapacityUserOptionResponse> users,
        List<CapabilitySkillResponse> skills,
        List<UserCapabilityResponse> userCapabilities,
        List<CapabilityMemberResponse> members,
        List<CapabilityWorkItemResponse> workItems,
        List<CapabilityDevelopmentActionResponse> developmentActions,
        List<CapabilitySnapshotSummaryResponse> snapshots
) {
}
