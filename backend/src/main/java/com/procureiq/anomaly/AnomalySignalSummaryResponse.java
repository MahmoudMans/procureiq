package com.procureiq.anomaly;

import java.math.BigDecimal;

public record AnomalySignalSummaryResponse(
        AnomalySignalType signalType,
        long activeFindings,
        long criticalFindings,
        BigDecimal exposure
) {
}
