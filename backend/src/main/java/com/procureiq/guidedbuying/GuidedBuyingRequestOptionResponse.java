package com.procureiq.guidedbuying;

import java.math.BigDecimal;
import java.util.UUID;

public record GuidedBuyingRequestOptionResponse(
        UUID id,
        String requestNumber,
        String title,
        UUID departmentId,
        String departmentName,
        String status,
        String currency,
        BigDecimal estimatedTotal
) {
}
