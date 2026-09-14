package com.procureiq.commercialgovernance;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CommercialLeakageFindingResponse(
        UUID id,
        UUID governanceId,
        UUID contractId,
        UUID supplierId,
        String supplierName,

        UUID purchaseOrderId,
        String purchaseOrderNumber,

        UUID negotiationWorkspaceId,
        String negotiationNumber,

        CommercialLeakageType findingType,
        CommercialLeakageSeverity severity,
        CommercialLeakageStatus status,

        String currency,

        BigDecimal expectedValue,
        BigDecimal actualValue,
        BigDecimal leakageAmount,

        String sourceReference,
        String details,

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
