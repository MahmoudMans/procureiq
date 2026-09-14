package com.procureiq.supplierportal;

import com.procureiq.suppliercollaboration.CollaborationMessageDirection;
import com.procureiq.suppliercollaboration.CollaborationMessageType;

import java.time.Instant;
import java.util.UUID;

public record SupplierPortalMessageResponse(
        UUID id,
        CollaborationMessageType messageType,
        CollaborationMessageDirection direction,
        String body,
        String referenceText,
        String senderName,
        UUID respondsToMessageId,
        Instant createdAt
) {
}
