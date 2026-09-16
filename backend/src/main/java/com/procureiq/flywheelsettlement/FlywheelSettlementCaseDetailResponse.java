package com.procureiq.flywheelsettlement;

import java.util.List;

public record FlywheelSettlementCaseDetailResponse(
        FlywheelSettlementCaseResponse settlementCase,

        FlywheelSettlementReleaseAuthorityResponse releaseAuthority,

        List<FlywheelSettlementUserOptionResponse> users,

        List<FlywheelSettlementCandidateItemResponse> candidates,

        List<FlywheelSettlementItemResponse> items,

        List<FlywheelSettlementSnapshotSummaryResponse> snapshots
) {
}
