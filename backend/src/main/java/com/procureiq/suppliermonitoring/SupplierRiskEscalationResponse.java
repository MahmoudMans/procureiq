package com.procureiq.suppliermonitoring;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SupplierRiskEscalationResponse(
        UUID id,
        String caseNumber,
        UUID supplierId,
        UUID alertId,
        UUID ownerUserId,
        String ownerName,
        SupplierRiskEscalationPriority priority,
        SupplierRiskEscalationStatus status,
        LocalDate dueDate,
        boolean overdue,
        String rationale,
        String resolutionNote,
        Instant closedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
