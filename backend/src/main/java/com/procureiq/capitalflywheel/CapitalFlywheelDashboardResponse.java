package com.procureiq.capitalflywheel;

import java.util.List;

public record CapitalFlywheelDashboardResponse(
        CapitalFlywheelSummaryResponse summary,
        List<CapitalFlywheelUserOptionResponse> users,
        List<CapitalFlywheelCandidateResponse> candidates,
        List<CapitalFlywheelLineageResponse> lineages,
        List<CapitalFlywheelSnapshotSummaryResponse> snapshots
) {
}
