package com.procureiq.categorymanagement;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CategoryInitiativeResponse(
        UUID id,
        UUID strategyId,
        String initiativeNumber,
        CategoryInitiativeType initiativeType,
        String title,
        String description,
        CategoryInitiativePriority priority,
        CategoryInitiativeStatus status,
        UUID ownerUserId,
        String ownerName,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        boolean overdue,
        BigDecimal estimatedValue,
        BigDecimal targetSavings,
        BigDecimal realizedSavings,
        BigDecimal realizationPct,
        List<CategoryMilestoneResponse> milestones,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
