package com.procureiq.operatingrhythm;

import com.procureiq.controltower.ControlTowerExceptionType;
import com.procureiq.controltower.ControlTowerItemStatus;
import com.procureiq.controltower.ControlTowerSeverity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OperatingRhythmSourceItem(
        UUID id,
        ControlTowerExceptionType exceptionType,
        ControlTowerSeverity severity,
        ControlTowerItemStatus status,
        UUID ownerUserId,
        String ownerName,
        BigDecimal monetaryExposure,
        Instant firstSeenAt,
        Instant slaDueAt,
        Instant resolvedAt
) {
}
