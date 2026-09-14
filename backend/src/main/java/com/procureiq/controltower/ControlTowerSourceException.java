package com.procureiq.controltower;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ControlTowerSourceException(
        String exceptionKey,
        ControlTowerExceptionType exceptionType,
        String sourceEntityType,
        UUID sourceEntityId,
        String sourceReference,
        String title,
        String details,
        ControlTowerSeverity sourceSeverity,
        BigDecimal monetaryExposure,
        LocalDate sourceDueDate
) {
}
