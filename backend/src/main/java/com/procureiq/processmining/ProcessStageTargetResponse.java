package com.procureiq.processmining;

public record ProcessStageTargetResponse(
        long id,
        ProcessEntityType entityType,
        String status,
        int targetHours
) {
}
