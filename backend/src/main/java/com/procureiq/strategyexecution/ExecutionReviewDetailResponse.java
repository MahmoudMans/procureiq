package com.procureiq.strategyexecution;

import java.util.List;

public record ExecutionReviewDetailResponse(
        ExecutionReviewSummaryResponse review,
        StrategyExecutionSummaryResponse summary,
        List<ExecutionCommitmentResponse> commitments
) {
}
