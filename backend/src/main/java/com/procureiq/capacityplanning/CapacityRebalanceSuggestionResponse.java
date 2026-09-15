package com.procureiq.capacityplanning;

import java.math.BigDecimal;
import java.util.UUID;

public record CapacityRebalanceSuggestionResponse(
        UUID fromUserId,
        String fromUserName,
        UUID toUserId,
        String toUserName,
        BigDecimal suggestedHours,
        String rationale
) {
}
