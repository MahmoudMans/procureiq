package com.procureiq.capitalredeployment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CapitalRedeploymentVerificationResponse(
        UUID id,
        UUID redeploymentCaseId,
        CapitalRedeploymentVerificationDecision decision,
        BigDecimal approvedRedeploymentAmount,
        BigDecimal releasedRedeploymentAmount,
        BigDecimal remainingRedeploymentAmount,
        BigDecimal redeploymentPct,
        BigDecimal redeploymentVarianceAmount,
        String verificationNote,
        String verifiedByName,
        Instant verifiedAt
) {
}
