package com.procureiq.capitalredeployment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalRedeploymentSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        int caseCount,
        int plannedCaseCount,
        int authorizationPendingCaseCount,
        int activeCaseCount,
        int readyCaseCount,
        int verifiedCaseCount,
        int remediationCaseCount,
        BigDecimal totalApprovedRedeploymentAmount,
        BigDecimal totalReleasedRedeploymentAmount,
        BigDecimal totalRemainingRedeploymentAmount,
        BigDecimal averageRedeploymentPct,
        String capturedByName,
        Instant capturedAt
) {
}
