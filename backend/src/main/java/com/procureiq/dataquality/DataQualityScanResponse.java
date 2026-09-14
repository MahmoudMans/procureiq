package com.procureiq.dataquality;

public record DataQualityScanResponse(
        long candidatesDetected,
        long createdFindings,
        long refreshedFindings,
        long autoResolvedFindings
) {
}
