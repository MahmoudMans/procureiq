package com.procureiq.capitalredeployment;

import java.math.BigDecimal;

public record CapitalRedeploymentSummaryResponse(
        int candidateCount,
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
        BigDecimal averageRedeploymentPct
) {
}
