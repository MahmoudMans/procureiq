package com.procureiq.successionplanning;

import java.math.BigDecimal;

public record SuccessionPolicyScore(
        BigDecimal coveragePct,
        BigDecimal policyScore,
        SuccessionHealth health
) {
}
