package com.procureiq.reporting;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ReportSnapshotResponse(
        UUID id,
        ReportType reportType,
        LocalDate periodStart,
        LocalDate periodEnd,
        String label,
        UUID createdByUserId,
        String createdByName,
        Instant createdAt
) {
}
