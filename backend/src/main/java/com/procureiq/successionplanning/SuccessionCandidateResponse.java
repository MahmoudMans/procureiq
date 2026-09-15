package com.procureiq.successionplanning;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SuccessionCandidateResponse(
        UUID id,
        UUID policyId,
        UUID userId,
        String userName,
        String role,
        SuccessionCandidateStatus status,
        int currentProficiency,
        BigDecimal proficiencyFitPct,
        BigDecimal capacityUtilizationPct,
        BigDecimal evidenceScore,
        SuccessionCandidateReadiness readiness,
        int openDevelopmentActionCount,
        String rationale,
        LocalDate targetDate,
        String decisionNote,
        long version
) {
}
