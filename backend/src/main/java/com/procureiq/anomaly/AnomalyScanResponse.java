package com.procureiq.anomaly;

public record AnomalyScanResponse(
        long candidatesDetected,
        long createdFindings,
        long refreshedFindings,
        long autoResolvedFindings
) {
}
