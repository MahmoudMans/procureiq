package com.procureiq.strategyexecution;

import java.util.List;

public record StrategyExecutionDashboardResponse(
        StrategyExecutionSummaryResponse summary,
        List<ExecutionCommitmentResponse> commitments,
        List<ExecutionReviewSummaryResponse> reviews
) {
}
