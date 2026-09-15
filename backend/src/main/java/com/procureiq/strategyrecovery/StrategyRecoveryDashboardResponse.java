package com.procureiq.strategyrecovery;

import java.util.List;

public record StrategyRecoveryDashboardResponse(
        StrategyRecoverySummaryResponse summary,
        List<RecoveryUserOptionResponse> users,
        List<RecoveryCandidateResponse> candidates,
        List<RecoveryCaseResponse> cases,
        List<RecoveryReviewSummaryResponse> reviews
) {
}
