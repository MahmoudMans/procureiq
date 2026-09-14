package com.procureiq.risk;

public record SystemRiskRefreshResponse(
        long discoveredConditions,
        long createdCases,
        long updatedCases,
        long reopenedCases
) {
}
