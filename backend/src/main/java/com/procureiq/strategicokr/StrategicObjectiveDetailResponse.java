package com.procureiq.strategicokr;

import java.util.List;

public record StrategicObjectiveDetailResponse(
        StrategicObjectiveSummaryResponse objective,
        String description,
        List<KeyResultResponse> keyResults,
        List<OkrSnapshotSummaryResponse> snapshots
) {
}
