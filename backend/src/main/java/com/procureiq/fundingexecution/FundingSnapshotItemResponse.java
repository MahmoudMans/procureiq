package com.procureiq.fundingexecution;

import java.math.BigDecimal;
import java.util.UUID;

public record FundingSnapshotItemResponse(
        UUID trancheId,
        String trancheNumber,
        int sequenceNo,
        String title,
        BigDecimal plannedReleaseAmount,
        BigDecimal releasedAmount,
        FundingTrancheStatus status,
        int gateCount,
        int resolvedGateCount,
        int authorizationCount
) {
}
