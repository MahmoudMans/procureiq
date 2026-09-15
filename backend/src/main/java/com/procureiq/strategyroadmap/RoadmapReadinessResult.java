package com.procureiq.strategyroadmap;

import java.math.BigDecimal;

public record RoadmapReadinessResult(
        BigDecimal ownerCoveragePct,
        BigDecimal dependencyHealthPct,
        BigDecimal milestoneHealthPct,
        BigDecimal gateHealthPct,
        BigDecimal readinessScore,
        RoadmapReadinessHealth health
) {
}
