package com.procureiq.benefitgovernance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record BenefitAssumptionResponse(
        UUID id,
        UUID portfolioId,
        BenefitAssumptionType assumptionType,
        String description,
        BigDecimal financialImpact,
        BenefitAssumptionStatus status,
        UUID ownerUserId,
        String ownerName,
        LocalDate reviewDate,
        boolean reviewOverdue,
        String resolutionNote,
        String resolvedByName,
        Instant resolvedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
