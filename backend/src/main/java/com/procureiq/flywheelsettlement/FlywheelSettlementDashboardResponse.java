package com.procureiq.flywheelsettlement;

import java.util.List;

public record FlywheelSettlementDashboardResponse(
        FlywheelSettlementSummaryResponse summary,

        List<FlywheelSettlementUserOptionResponse> users,

        List<FlywheelSettlementReleaseAuthorityResponse> releases,

        List<FlywheelSettlementCaseResponse> cases,

        List<FlywheelSettlementSnapshotSummaryResponse> snapshots
) {
}
