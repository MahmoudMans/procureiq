package com.procureiq.dataquality;

import java.math.BigDecimal;
import java.time.Instant;

public record DataQualitySummaryResponse(
        BigDecimal overallScore,
        long openFindings,
        long criticalFindings,
        long duplicateCandidates,
        long remediationInProgress,
        long activeRemediationTasks,
        long overdueRemediationTasks,
        Instant lastScanAt
) {
}
