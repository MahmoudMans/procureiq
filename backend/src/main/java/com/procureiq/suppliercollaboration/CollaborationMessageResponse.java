package com.procureiq.suppliercollaboration;

import java.time.Instant;
import java.util.UUID;

public record CollaborationMessageResponse(
        UUID id,
        UUID workspaceId,
        CollaborationMessageType messageType,
        CollaborationMessageVisibility visibility,
        CollaborationMessageDirection direction,
        String body,
        String referenceText,
        UUID authorUserId,
        String authorName,
        String supplierContactName,
        UUID respondsToMessageId,
        Instant createdAt
) {
}
