package com.procureiq.guidedbuying;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record GuidedBuyingIntakeResponse(
        UUID id,
        String intakeNumber,
        String title,
        String description,

        UUID departmentId,
        String departmentName,

        String category,
        String currency,
        BigDecimal estimatedAmount,

        UUID supplierId,
        String supplierName,
        String supplierRiskLevel,

        UUID templateId,
        String templateCode,
        String templateName,

        UUID requesterUserId,
        String requesterName,

        GuidedBuyingIntakeStatus status,
        GuidedBuyingRoute guidanceRoute,
        String guidanceSummary,

        UUID linkedPurchaseRequestId,
        String linkedRequestNumber,
        String linkedRequestStatus,

        String notes,

        Instant convertedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
