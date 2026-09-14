package com.procureiq.operatingrhythm;

import com.procureiq.controltower.ControlTowerExceptionType;
import com.procureiq.controltower.ControlTowerItemStatus;
import com.procureiq.controltower.ControlTowerSeverity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OperatingRhythmAnalyticsServiceTest {

    private OperatingRhythmAnalyticsService service;

    private Instant now;

    @BeforeEach
    void setUp() {
        service =
                new OperatingRhythmAnalyticsService();

        now =
                Instant.parse(
                        "2026-09-14T12:00:00Z"
                );
    }

    @Test
    void shouldMeasureActiveBacklogAndSlaOverdue() {
        OperatingRhythmSourceItem overdue =
                item(
                        ControlTowerExceptionType.SUPPLIER_RISK_ALERT,
                        ControlTowerSeverity.CRITICAL,
                        ControlTowerItemStatus.OPEN,
                        "2026-09-01T00:00:00Z",
                        "2026-09-10T00:00:00Z",
                        null,
                        new BigDecimal(
                                "10000.00"
                        ),
                        null
                );

        OperatingRhythmAnalysis result =
                service.analyze(
                        List.of(
                                overdue
                        ),
                        LocalDate.of(
                                2026,
                                8,
                                16
                        ),
                        LocalDate.of(
                                2026,
                                9,
                                14
                        ),
                        now
                );

        assertEquals(
                1,
                result.metrics()
                        .activeBacklogCount()
        );

        assertEquals(
                1,
                result.metrics()
                        .slaOverdueCount()
        );

        assertEquals(
                1,
                result.metrics()
                        .persistentExceptionCount()
        );
    }

    @Test
    void shouldCalculateSlaAttainmentFromResolvedItems() {
        OperatingRhythmSourceItem onTime =
                item(
                        ControlTowerExceptionType.BENEFIT_LEAKAGE,
                        ControlTowerSeverity.HIGH,
                        ControlTowerItemStatus.RESOLVED,
                        "2026-09-01T00:00:00Z",
                        "2026-09-05T00:00:00Z",
                        "2026-09-04T00:00:00Z",
                        BigDecimal.ZERO,
                        UUID.randomUUID()
                );

        OperatingRhythmSourceItem late =
                item(
                        ControlTowerExceptionType.GOVERNANCE_ACTION_OVERDUE,
                        ControlTowerSeverity.HIGH,
                        ControlTowerItemStatus.RESOLVED,
                        "2026-09-01T00:00:00Z",
                        "2026-09-03T00:00:00Z",
                        "2026-09-06T00:00:00Z",
                        BigDecimal.ZERO,
                        UUID.randomUUID()
                );

        OperatingRhythmAnalysis result =
                service.analyze(
                        List.of(
                                onTime,
                                late
                        ),
                        LocalDate.of(
                                2026,
                                9,
                                1
                        ),
                        LocalDate.of(
                                2026,
                                9,
                                14
                        ),
                        now
                );

        assertEquals(
                2,
                result.metrics()
                        .resolvedCount()
        );

        assertEquals(
                1,
                result.metrics()
                        .onTimeResolvedCount()
        );

        assertEquals(
                new BigDecimal(
                        "50.00"
                ),
                result.metrics()
                        .slaAttainmentPct()
        );
    }

    @Test
    void shouldCreateDomainAndOwnerDimensions() {
        UUID ownerId =
                UUID.randomUUID();

        OperatingRhythmSourceItem item =
                item(
                        ControlTowerExceptionType.SOURCING_INITIATIVE_OVERDUE,
                        ControlTowerSeverity.HIGH,
                        ControlTowerItemStatus.IN_PROGRESS,
                        "2026-09-10T00:00:00Z",
                        "2026-09-20T00:00:00Z",
                        null,
                        new BigDecimal(
                                "5000.00"
                        ),
                        ownerId
                );

        OperatingRhythmAnalysis result =
                service.analyze(
                        List.of(
                                item
                        ),
                        LocalDate.of(
                                2026,
                                9,
                                1
                        ),
                        LocalDate.of(
                                2026,
                                9,
                                14
                        ),
                        now
                );

        assertTrue(
                result.dimensions()
                        .stream()
                        .anyMatch(
                                dimension ->
                                        dimension.dimensionType()
                                                == OperatingRhythmDimensionType.DOMAIN
                                        &&
                                        dimension.dimensionKey()
                                                .equals(
                                                        "SOURCING"
                                                )
                        )
        );

        assertTrue(
                result.dimensions()
                        .stream()
                        .anyMatch(
                                dimension ->
                                        dimension.dimensionType()
                                                == OperatingRhythmDimensionType.OWNER
                                        &&
                                        dimension.dimensionKey()
                                                .equals(
                                                        ownerId.toString()
                                                )
                        )
        );
    }

    private OperatingRhythmSourceItem item(
            ControlTowerExceptionType type,
            ControlTowerSeverity severity,
            ControlTowerItemStatus status,
            String firstSeen,
            String slaDue,
            String resolved,
            BigDecimal exposure,
            UUID ownerId
    ) {
        return new OperatingRhythmSourceItem(
                UUID.randomUUID(),
                type,
                severity,
                status,
                ownerId,
                ownerId == null
                        ? null
                        : "Owner",
                exposure,
                Instant.parse(
                        firstSeen
                ),
                Instant.parse(
                        slaDue
                ),
                resolved == null
                        ? null
                        : Instant.parse(
                                resolved
                        )
        );
    }
}
