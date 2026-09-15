package com.procureiq.strategicalignment;

import java.math.BigDecimal;

public record AlignmentScoreResult(
        BigDecimal sourceCoveragePct,
        BigDecimal objectiveCoveragePct,
        BigDecimal valueCoveragePct,
        BigDecimal riskCoveragePct,
        BigDecimal scheduleAlignmentPct,
        BigDecimal alignmentScore,
        AlignmentHealth health
) {
}
