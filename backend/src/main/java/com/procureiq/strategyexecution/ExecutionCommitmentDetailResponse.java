package com.procureiq.strategyexecution;

import java.util.List;

public record ExecutionCommitmentDetailResponse(
        ExecutionCommitmentResponse commitment,
        List<ExecutionProgressResponse> progressUpdates,
        List<ExecutionOutcomeReportResponse> outcomes
) {
}
