package com.procureiq.capitalredeployment;

import java.math.BigDecimal;
import java.util.UUID;

public record CapitalRedeploymentSnapshotItemResponse(
        UUID redeploymentCaseId,
        String redeploymentNumber,
        String recyclingSourceNumber,
        String targetValueCaseNumber,
        String targetInitiativeTitle,
        String currency,
        CapitalRedeploymentStatus caseStatus,
        BigDecimal approvedRedeploymentAmount,
        BigDecimal releasedRedeploymentAmount,
        BigDecimal remainingRedeploymentAmount,
        BigDecimal redeploymentPct,
        BigDecimal redeploymentVarianceAmount,
        CapitalRedeploymentHealth redeploymentHealth,
        BigDecimal currentSourceFundingRemainingAmount,
        int gateCount,
        int resolvedGateCount,
        int authorizationCount,
        int releaseCount
) {
}
