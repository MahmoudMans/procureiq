package com.procureiq.suppliermonitoring;

import java.time.Instant;
import java.util.UUID;

public record SupplierRiskAlertResponse(
        UUID id,
        UUID supplierId,
        UUID evaluationId,
        SupplierRiskAlertType alertType,
        SupplierRiskAlertSeverity severity,
        SupplierRiskAlertStatus status,
        String title,
        String details,
        String acknowledgedByName,
        String acknowledgementNote,
        Instant acknowledgedAt,
        Instant resolvedAt,
        Instant createdAt,
        Instant lastSeenAt
) {
}
