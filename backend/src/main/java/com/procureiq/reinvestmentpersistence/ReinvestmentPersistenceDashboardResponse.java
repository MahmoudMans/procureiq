package com.procureiq.reinvestmentpersistence;

import java.util.List;

public record ReinvestmentPersistenceDashboardResponse(
        ReinvestmentPersistenceSummaryResponse summary,
        List<ReinvestmentPersistenceUserOptionResponse> users,
        List<ReinvestmentPersistenceCandidateResponse> candidates,
        List<ReinvestmentPersistenceCaseResponse> cases,
        List<ReinvestmentPersistenceSnapshotSummaryResponse> snapshots
) {
}
