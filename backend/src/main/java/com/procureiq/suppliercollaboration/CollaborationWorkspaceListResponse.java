package com.procureiq.suppliercollaboration;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CollaborationWorkspaceListResponse(
        UUID id,
        String workspaceNumber,

        UUID supplierId,
        String supplierCode,
        String supplierName,

        CollaborationWorkspaceType workspaceType,
        CollaborationWorkspaceStatus status,
        CollaborationPriority priority,

        String title,

        UUID purchaseOrderId,
        String purchaseOrderNumber,

        UUID rfqId,
        String rfqNumber,

        String externalReference,

        UUID ownerUserId,
        String ownerName,

        int supplierResponseSlaHours,
        Instant responseDueAt,
        boolean responseSlaBreached,

        Instant lastMessageAt,

        long openActions,
        long overdueActions,
        long supplierSharedMessages,
        long supplierResponseCount,
        BigDecimal averageSupplierResponseHours,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
