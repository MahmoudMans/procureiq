package com.procureiq.investmentperformance;

import java.util.List;

public record InvestmentPerformanceDashboardResponse(
        InvestmentPerformanceSummaryResponse summary,
        List<InvestmentPerformanceUserOptionResponse> users,
        List<InvestmentPerformanceCandidateResponse> candidates,
        List<InvestmentPerformanceCaseResponse> cases,
        List<InvestmentPerformanceSnapshotSummaryResponse> snapshots
) {
}
