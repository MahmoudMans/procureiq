package com.procureiq.demandconsolidation;

import com.procureiq.guidedbuying.GuidedBuyingRoute;
import com.procureiq.guidedbuying.GuidedBuyingIntakeStatus;

import java.math.BigDecimal;
import java.util.UUID;

public record DemandBundleItemResponse(
        UUID id,
        UUID intakeId,
        String intakeNumber,
        String title,
        UUID departmentId,
        String departmentName,
        BigDecimal estimatedAmount,
        GuidedBuyingIntakeStatus intakeStatus,
        GuidedBuyingRoute guidanceRoute
) {
}
