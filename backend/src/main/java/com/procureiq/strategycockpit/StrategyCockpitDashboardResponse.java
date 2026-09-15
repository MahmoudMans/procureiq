package com.procureiq.strategycockpit;

import java.util.List;

public record StrategyCockpitDashboardResponse(
        BoardScorecardSummaryResponse current,
        List<BoardDimensionResponse> dimensions,
        List<BoardExceptionResponse> exceptions,
        List<BoardSnapshotSummaryResponse> snapshots
) {
}
