package com.procureiq.flywheelremediation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelResidualRemediationSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,
        UUID remediationPlanId,
        String planNumber,
        String title,
        String currency,
        Integer fiscalYear,
        BigDecimal sourceResidualAmount,
        BigDecimal recoveryFollowUpAmount,
        BigDecimal writeOffReviewAmount,
        BigDecimal investigationEscalationAmount,
        BigDecimal residualAcceptanceReviewAmount,
        int itemCount,
        FlywheelResidualRemediationPlanStatus planStatus,
        UUID capturedByUserId,
        Instant capturedAt,
        boolean sealed
) {
}
