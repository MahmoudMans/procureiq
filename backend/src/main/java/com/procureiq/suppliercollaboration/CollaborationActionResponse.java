package com.procureiq.suppliercollaboration;

import java.time.Instant;
import java.util.UUID;

public record CollaborationActionResponse(
        UUID id,
        UUID workspaceId,
        CollaborationActionType actionType,
        CollaborationActionAudience audience,
        String title,
        String description,
        UUID assigneeUserId,
        String assigneeName,
        String externalAssigneeLabel,
        Instant dueAt,
        CollaborationActionStatus status,
        boolean overdue,
        String completionNote,
        Instant completedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
