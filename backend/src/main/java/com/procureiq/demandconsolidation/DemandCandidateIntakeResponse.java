package com.procureiq.demandconsolidation;

import com.procureiq.guidedbuying.GuidedBuyingRoute;
import com.procureiq.guidedbuying.GuidedBuyingIntakeStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record DemandCandidateIntakeResponse(
        UUID id,
        String intakeNumber,
        String title,
        UUID departmentId,
        String departmentName,
        String category,
        String currency,
        BigDecimal estimatedAmount,
        GuidedBuyingIntakeStatus status,
        GuidedBuyingRoute guidanceRoute,
        Instant createdAt
) {
}
