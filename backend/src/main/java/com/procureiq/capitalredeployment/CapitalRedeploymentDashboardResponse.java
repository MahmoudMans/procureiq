package com.procureiq.capitalredeployment;

import java.util.List;

public record CapitalRedeploymentDashboardResponse(
        CapitalRedeploymentSummaryResponse summary,
        List<CapitalRedeploymentUserOptionResponse> users,
        List<CapitalRedeploymentCandidateResponse> candidates,
        List<CapitalRedeploymentCaseResponse> cases,
        List<CapitalRedeploymentSnapshotSummaryResponse> snapshots
) {
}
