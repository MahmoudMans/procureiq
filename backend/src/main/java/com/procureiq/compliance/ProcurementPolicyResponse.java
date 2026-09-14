package com.procureiq.compliance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ProcurementPolicyResponse(
        UUID id,
        String policyCode,
        String name,
        String description,
        ProcurementPolicyType policyType,
        ProcurementPolicySeverity severity,
        ProcurementPolicyStatus status,
        BigDecimal thresholdAmount,
        String currency,
        boolean requiresWaiver,
        UUID ownerUserId,
        String ownerName,
        long openViolations,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
