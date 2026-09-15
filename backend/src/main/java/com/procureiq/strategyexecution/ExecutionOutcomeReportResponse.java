package com.procureiq.strategyexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ExecutionOutcomeReportResponse(
        UUID id,
        UUID commitmentId,
        BigDecimal reportedContributionPoints,
        String evidenceNote,
        String reportedByName,
        Instant reportedAt,
        ExecutionValidationDecision validationDecision,
        BigDecimal validatedContributionPoints,
        String validationNote,
        String validatedByName,
        Instant validatedAt
) {
}
