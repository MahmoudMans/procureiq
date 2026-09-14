package com.procureiq.processmining;

import java.time.Instant;
import java.util.UUID;

public record ProcessEventResponse(
        long id,
        ProcessEntityType entityType,
        UUID entityId,
        String entityReference,
        String status,
        String previousStatus,
        String eventType,
        String eventSource,
        String sourceTable,
        UUID departmentId,
        String category,
        Instant eventAt
) {
}
