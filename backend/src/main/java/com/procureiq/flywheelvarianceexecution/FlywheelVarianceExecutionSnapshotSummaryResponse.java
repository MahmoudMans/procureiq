package com.procureiq.flywheelvarianceexecution;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FlywheelVarianceExecutionSnapshotSummaryResponse(
        UUID id,
        String snapshotNumber,

        UUID executionCaseId,
        String executionNumber,

        UUID variancePlanId,
        String variancePlanNumber,

        FlywheelVarianceExecutionCaseStatus caseStatus,

        String currency,
        int fiscalYear,

        BigDecimal sourceVarianceAmount,

        BigDecimal capturedVarianceAmount,

        BigDecimal executedFinancialAmount,

        BigDecimal recoveredAmount,
        BigDecimal writtenOffAmount,
        BigDecimal completedInvestigationAmount,

        BigDecimal openExposureAmount,
        BigDecimal completionPct,

        int itemCount,
        int completedCount,
        int partialCount,
        int unresolvedCount,

        String capturedByName,
        Instant capturedAt
) {
}
