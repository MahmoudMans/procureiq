package com.procureiq.strategyrecovery;

import java.util.List;

public record RecoveryReviewDetailResponse(
        RecoveryReviewSummaryResponse review,
        List<RecoveryCaseResponse> cases
) {
}
