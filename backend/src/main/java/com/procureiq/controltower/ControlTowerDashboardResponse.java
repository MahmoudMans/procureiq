package com.procureiq.controltower;

import java.util.List;

public record ControlTowerDashboardResponse(
        ControlTowerSummaryResponse summary,
        List<ControlTowerItemResponse> items,
        ControlTowerRunResponse latestRun
) {
}
