package com.procureiq.continuousimprovement;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ImprovementInitiativeSummaryResponse(
        UUID id,
        String initiativeNumber,
        String title,
        String currency,
        ImprovementPriority priority,
        ImprovementInitiativeStatus status,
        UUID ownerUserId,
        String ownerName,
        UUID sourceSnapshotId,
        String sourceSnapshotNumber,
        ImprovementScopeType scopeType,
        String scopeKey,
        String scopeLabel,
        LocalDate targetDate,
        boolean targetOverdue,
        long openActions,
        long overdueActions,
        long checkpointCount,
        ImprovementOutcome latestOutcome,
        BigDecimal latestAchievementScore,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
