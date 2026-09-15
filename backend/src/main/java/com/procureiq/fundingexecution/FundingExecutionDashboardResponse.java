package com.procureiq.fundingexecution;

import java.util.List;

public record FundingExecutionDashboardResponse(
        FundingDashboardSummaryResponse summary,
        List<FundingUserOptionResponse> users,
        List<FundingCandidateResponse> candidates,
        List<FundingCommitmentResponse> commitments,
        List<FundingSnapshotSummaryResponse> snapshots
) {
}
