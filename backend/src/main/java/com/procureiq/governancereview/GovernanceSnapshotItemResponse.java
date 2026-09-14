package com.procureiq.governancereview;

import java.math.BigDecimal;
import java.util.UUID;

public record GovernanceSnapshotItemResponse(
        UUID id,
        GovernanceSnapshotItemType itemType,
        String itemKey,
        int rankPosition,
        GovernanceSeverity severity,
        String title,
        String subtitle,
        String metricLabel,
        BigDecimal metricValue,
        String currency,
        String details
) {
}
