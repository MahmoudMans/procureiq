package com.procureiq.strategicokr;

import java.util.List;

public record OkrSnapshotDetailResponse(
        OkrSnapshotSummaryResponse snapshot,
        String objectiveNumber,
        String objectiveTitle,
        String currency,
        StrategicObjectivePeriodType periodType,
        int fiscalYear,
        Integer quarter,
        String objectiveStatus,
        List<OkrSnapshotKeyResultResponse> keyResults
) {
}
