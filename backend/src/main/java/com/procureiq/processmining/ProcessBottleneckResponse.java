package com.procureiq.processmining;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ProcessBottleneckResponse(
        ProcessEntityType entityType,
        UUID entityId,
        String entityReference,
        String status,
        UUID departmentId,
        String departmentName,
        String category,
        BigDecimal ageHours,
        int targetHours,
        BigDecimal targetRatio,
        ProcessBottleneckSeverity severity,
        Instant enteredStageAt
) {
}
