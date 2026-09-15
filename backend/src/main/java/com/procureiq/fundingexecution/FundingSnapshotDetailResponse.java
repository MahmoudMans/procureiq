package com.procureiq.fundingexecution;

import java.util.List;

public record FundingSnapshotDetailResponse(
        FundingSnapshotSummaryResponse snapshot,
        List<FundingSnapshotItemResponse> items
) {
}
