package com.procureiq.compliance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PolicyViolationResponse(
        UUID id,

        UUID policyId,
        String policyCode,
        String policyName,
        ProcurementPolicyType policyType,

        PolicyViolationSourceType sourceType,
        UUID sourceId,
        String sourceReference,

        BigDecimal sourceAmount,
        String currency,

        ProcurementPolicySeverity severity,
        PolicyViolationStatus status,

        String details,

        String policyOwnerName,

        String sourceHref,

        Instant detectedAt,
        Instant lastCheckedAt,

        String resolutionNote,
        Instant resolvedAt,
        String resolvedByName,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
