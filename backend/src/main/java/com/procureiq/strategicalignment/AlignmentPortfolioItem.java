package com.procureiq.strategicalignment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record AlignmentPortfolioItem(
        AlignmentSourceType sourceType,
        UUID sourceEntityId,
        String sourceReference,
        String sourceTitle,
        String sourceStatus,
        BigDecimal strategicValue,
        BigDecimal riskExposure,
        BigDecimal riskScore,
        LocalDate dueDate
) {
}
