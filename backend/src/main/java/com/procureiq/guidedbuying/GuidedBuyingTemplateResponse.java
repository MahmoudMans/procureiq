package com.procureiq.guidedbuying;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record GuidedBuyingTemplateResponse(
        UUID id,
        String templateCode,
        String name,
        String description,
        String category,
        String defaultTitle,
        String defaultCurrency,
        BigDecimal defaultEstimatedAmount,
        UUID defaultDepartmentId,
        String defaultDepartmentName,
        boolean active,
        UUID ownerUserId,
        String ownerName,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
