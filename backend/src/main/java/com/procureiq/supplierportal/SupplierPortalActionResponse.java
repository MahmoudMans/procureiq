package com.procureiq.supplierportal;

import com.procureiq.suppliercollaboration.CollaborationActionStatus;
import com.procureiq.suppliercollaboration.CollaborationActionType;

import java.time.Instant;
import java.util.UUID;

public record SupplierPortalActionResponse(
        UUID id,
        CollaborationActionType actionType,
        String title,
        String description,
        String assigneeLabel,
        Instant dueAt,
        CollaborationActionStatus status,
        boolean overdue,
        String completionNote,
        Instant completedAt
) {
}
