package com.procureiq.reinvestmentperformance;

import java.util.List;

public record ReinvestmentPerformanceDashboardResponse(
        ReinvestmentPerformanceSummaryResponse summary,
        List<ReinvestmentPerformanceUserOptionResponse> users,
        List<ReinvestmentPerformanceCandidateResponse> candidates,
        List<ReinvestmentPerformanceCaseResponse> cases,
        List<ReinvestmentPerformanceSnapshotSummaryResponse> snapshots
) {
}
