package com.procureiq.commandcenter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CommandCenterActionResponse(
        UUID id,
        CommandCenterActionType type,
        CommandCenterSeverity severity,
        String title,
        String description,
        String reference,
        LocalDate dueDate,
        Long daysToDue,
        boolean overdue,
        BigDecimal amount,
        String currency,
        String ownerName,
        String href
) {
}
