package com.procureiq.benefitgovernance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record BenefitLeakageResponse(
        UUID id,
        UUID benefitItemId,
        String initiativeNumber,
        String initiativeTitle,
        BenefitLeakageType leakageType,
        BigDecimal amount,
        BenefitLeakageStatus status,
        String description,
        UUID ownerUserId,
        String ownerName,
        LocalDate dueDate,
        boolean overdue,
        String resolutionNote,
        String resolvedByName,
        Instant resolvedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
