package com.procureiq.controltower;

import java.math.BigDecimal;
import java.time.Instant;

public record ControlTowerPriorityResult(
        BigDecimal priorityScore,
        ControlTowerSeverity severity,
        Instant slaDueAt
) {
}
