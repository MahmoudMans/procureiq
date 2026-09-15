package com.procureiq.successionplanning;

import java.math.BigDecimal;

public record SuccessionSummaryResponse(
        int policyCount,
        int coveredPolicyCount,
        int exposedPolicyCount,
        int criticalExposureCount,
        int singlePointFailureCount,
        int nominatedCandidateCount,
        int readyCandidateCount,
        BigDecimal averageReadyPeople,
        BigDecimal policyCoveragePct,
        BigDecimal averagePolicyScore,
        BigDecimal successionScore,
        SuccessionHealth successionHealth
) {
}
