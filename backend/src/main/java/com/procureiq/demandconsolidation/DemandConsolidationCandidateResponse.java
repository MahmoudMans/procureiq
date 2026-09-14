package com.procureiq.demandconsolidation;

import java.math.BigDecimal;
import java.util.List;

public record DemandConsolidationCandidateResponse(
        String candidateKey,
        String category,
        String currency,
        int intakeCount,
        int departmentCount,
        BigDecimal totalValue,
        BigDecimal expectedLeveragePct,
        BigDecimal expectedSavings,
        List<DemandCandidateIntakeResponse> intakes
) {
}
