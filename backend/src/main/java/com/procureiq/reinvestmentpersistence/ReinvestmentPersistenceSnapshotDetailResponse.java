package com.procureiq.reinvestmentpersistence;

import java.util.List;

public record ReinvestmentPersistenceSnapshotDetailResponse(
        ReinvestmentPersistenceSnapshotSummaryResponse snapshot,
        List<ReinvestmentPersistenceSnapshotItemResponse> items
) {
}
