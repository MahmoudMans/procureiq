package com.procureiq.compliance;

import java.math.BigDecimal;

public record PolicyComplianceSummaryResponse(
        long totalPolicies,
        long activePolicies,
        long totalViolations,
        long openViolations,
        long criticalViolations,
        long highViolations,
        long pendingWaivers,
        long waivedViolations,
        long resolvedViolations,
        BigDecimal resolutionRate
) {
}
