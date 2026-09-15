package com.procureiq.strategycockpit;

import java.util.List;

public record BoardSnapshotDetailResponse(
        BoardSnapshotSummaryResponse snapshot,
        BoardScorecardSummaryResponse summary,
        List<BoardDimensionResponse> dimensions,
        List<BoardExceptionResponse> exceptions
) {
}
