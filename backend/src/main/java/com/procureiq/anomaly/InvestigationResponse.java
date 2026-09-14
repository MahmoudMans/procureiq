package com.procureiq.anomaly;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record InvestigationResponse(
        UUID id,
        String caseNumber,
        UUID findingId,
        UUID ownerUserId,
        String ownerName,
        InvestigationPriority priority,
        InvestigationStatus status,
        LocalDate dueDate,
        boolean overdue,
        String conclusion,
        Instant closedAt,
        List<InvestigationEvidenceResponse> evidence,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
