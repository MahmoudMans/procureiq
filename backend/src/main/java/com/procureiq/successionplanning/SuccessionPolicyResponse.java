package com.procureiq.successionplanning;

import java.math.BigDecimal;
import java.util.UUID;

public record SuccessionPolicyResponse(
        UUID id,
        String currency,
        int fiscalYear,
        UUID skillId,
        String skillCode,
        String skillName,
        String skillCategory,
        SuccessionCriticality criticality,
        int requiredProficiency,
        int targetReadyPeople,
        String notes,
        int strategicWorkCount,
        int assignedMemberCount,
        int readyPeopleCount,
        int readyBenchCount,
        int nominatedCandidateCount,
        int readyCandidateCount,
        boolean singlePointFailure,
        BigDecimal coveragePct,
        BigDecimal policyScore,
        SuccessionHealth health,
        long version
) {
}
