package com.procureiq.strategicalignment;

import java.math.BigDecimal;

public record StrategicAlignmentSummaryResponse(
        int objectiveCount,
        int objectivesWithAlignment,
        int candidateSourceCount,
        int alignedSourceCount,
        int unalignedSourceCount,
        int fullyAlignedSourceCount,
        int partiallyAlignedSourceCount,
        int splitCommitmentCount,
        int deadlineConflictCount,
        BigDecimal strategicValueTotal,
        BigDecimal strategicValueAligned,
        BigDecimal riskExposureTotal,
        BigDecimal riskExposureAligned,
        BigDecimal sourceCoveragePct,
        BigDecimal objectiveCoveragePct,
        BigDecimal valueCoveragePct,
        BigDecimal riskCoveragePct,
        BigDecimal scheduleAlignmentPct,
        BigDecimal alignmentScore,
        AlignmentHealth alignmentHealth
) {
}
