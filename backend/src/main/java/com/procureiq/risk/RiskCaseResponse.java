package com.procureiq.risk;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record RiskCaseResponse(
        UUID id,
        String riskNumber,
        RiskOrigin origin,
        RiskCategory category,
        RiskSeverity severity,
        RiskCaseStatus status,
        String title,
        String description,
        int likelihood,
        int impact,
        int riskScore,
        LocalDate dueDate,
        boolean overdue,

        UUID supplierId,
        String supplierName,

        UUID contractId,
        String contractNumber,

        UUID purchaseOrderId,
        String purchaseOrderNumber,

        UUID rfqId,
        String rfqNumber,

        UUID ownerUserId,
        String ownerName,

        UUID createdByUserId,
        String createdByName,

        boolean escalated,
        Instant escalatedAt,
        String escalatedByName,

        String resolutionNote,
        Instant resolvedAt,
        String resolvedByName,

        long openMitigationActions,
        long completedMitigationActions,
        List<RiskMitigationActionResponse> mitigationActions,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
