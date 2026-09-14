package com.procureiq.categorymanagement;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record CategoryMilestoneResponse(
        UUID id,
        UUID initiativeId,
        String title,
        LocalDate dueDate,
        CategoryMilestoneStatus status,
        boolean overdue,
        String completionNote,
        Instant completedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
