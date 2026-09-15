package com.procureiq.interventionexecution;

import java.util.List;

public record InterventionExecutionDashboardResponse(
        InterventionExecutionSummaryResponse summary,
        List<InterventionExecutionUserOptionResponse> users,
        List<InterventionExecutionCandidateResponse> candidates,
        List<InterventionExecutionCaseResponse> cases,
        List<InterventionExecutionSnapshotSummaryResponse> snapshots
) {
}
