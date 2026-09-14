package com.procureiq.governancereview;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record GovernanceDecisionResponse(
        UUID id,
        String decisionNumber,
        UUID reviewId,
        GovernanceDecisionType decisionType,
        String title,
        String description,
        GovernanceDecisionStatus status,
        String requestedByName,
        UUID decisionOwnerUserId,
        String decisionOwnerName,
        LocalDate dueDate,
        boolean overdue,
        String decisionNote,
        String decidedByName,
        Instant decidedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
