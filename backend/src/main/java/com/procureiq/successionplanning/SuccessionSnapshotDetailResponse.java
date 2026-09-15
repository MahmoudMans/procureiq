package com.procureiq.successionplanning;

import java.util.List;

public record SuccessionSnapshotDetailResponse(
        SuccessionSnapshotSummaryResponse snapshot,
        SuccessionSummaryResponse summary,
        List<SuccessionPolicyResponse> policies,
        List<SuccessionCandidateResponse> candidates
) {
}
