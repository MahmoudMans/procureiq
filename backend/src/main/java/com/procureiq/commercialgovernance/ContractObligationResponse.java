package com.procureiq.commercialgovernance;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ContractObligationResponse(
        UUID id,
        UUID governanceId,
        ContractObligationType obligationType,
        String title,
        String description,
        LocalDate dueDate,
        boolean critical,
        ContractObligationStatus status,
        UUID ownerUserId,
        String ownerName,
        boolean overdue,
        String completionNote,
        Instant completedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
