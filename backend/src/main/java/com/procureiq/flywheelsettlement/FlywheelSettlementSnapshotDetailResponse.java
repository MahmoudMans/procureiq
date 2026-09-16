package com.procureiq.flywheelsettlement;

import java.util.List;

public record FlywheelSettlementSnapshotDetailResponse(
        FlywheelSettlementSnapshotSummaryResponse snapshot,
        List<FlywheelSettlementSnapshotItemResponse> items
) {
}
