package com.procureiq.supplierinsight;

import java.time.Instant;

public record Supplier360ActivityResponse(
        String eventType,
        String title,
        String detail,
        String href,
        Instant occurredAt
) {
}
