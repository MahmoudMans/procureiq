package com.procureiq.controltower;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ControlTowerItemResponse(
        UUID id,
        String exceptionKey,
        ControlTowerExceptionType exceptionType,

        String sourceEntityType,
        UUID sourceEntityId,
        String sourceReference,

        String currency,
        String title,
        String details,

        ControlTowerSeverity severity,
        BigDecimal priorityScore,
        BigDecimal monetaryExposure,

        LocalDate sourceDueDate,
        Instant slaDueAt,
        boolean slaOverdue,

        ControlTowerItemStatus status,

        UUID ownerUserId,
        String ownerName,

        String acknowledgedByName,
        String acknowledgementNote,
        Instant acknowledgedAt,

        Instant startedAt,

        String resolutionNote,
        String resolvedByName,
        Instant resolvedAt,

        Instant firstSeenAt,
        Instant lastSeenAt,
        long ageDays,

        long version
) {
}
