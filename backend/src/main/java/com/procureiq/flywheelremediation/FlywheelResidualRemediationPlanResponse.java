package com.procureiq.flywheelremediation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelResidualRemediationPlanResponse(
        UUID id,
        String planNumber,
        UUID sourceExecutionCaseId,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal sourceResidualAmount,
        int sourcePositiveItemCount,
        BigDecimal coveredResidualAmount,
        BigDecimal recoveryFollowUpAmount,
        BigDecimal writeOffReviewAmount,
        BigDecimal investigationEscalationAmount,
        BigDecimal residualAcceptanceReviewAmount,
        int itemCount,
        UUID ownerUserId,
        String ownerName,
        String remediationObjective,
        FlywheelResidualRemediationPlanStatus status,
        UUID reviewSubmittedByUserId,
        Instant reviewSubmittedAt,
        UUID approvedByUserId,
        Instant approvedAt,
        String approvalNote,
        UUID closedByUserId,
        Instant closedAt,
        String closeNote,
        long version,
        UUID createdByUserId,
        Instant createdAt,
        Instant updatedAt
) {
}
