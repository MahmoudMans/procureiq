package com.procureiq.controltower;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ControlTowerPriorityServiceTest {

    private ControlTowerPriorityService service;

    private Instant now;

    @BeforeEach
    void setUp() {
        service =
                new ControlTowerPriorityService();

        now =
                Instant.parse(
                        "2026-09-14T10:00:00Z"
                );
    }

    @Test
    void shouldPrioritizeCriticalSupplierRisk() {
        ControlTowerPriorityResult result =
                service.evaluate(
                        source(
                                ControlTowerExceptionType.SUPPLIER_RISK_ALERT,
                                ControlTowerSeverity.CRITICAL,
                                BigDecimal.ZERO,
                                null
                        ),
                        now
                );

        assertEquals(
                ControlTowerSeverity.CRITICAL,
                result.severity()
        );

        assertTrue(
                result.priorityScore()
                        .compareTo(
                                new BigDecimal(
                                        "80.00"
                                )
                        ) >= 0
        );
    }

    @Test
    void shouldBoostOverdueHighExposureLeakage() {
        ControlTowerPriorityResult result =
                service.evaluate(
                        source(
                                ControlTowerExceptionType.BENEFIT_LEAKAGE,
                                ControlTowerSeverity.HIGH,
                                new BigDecimal(
                                        "150000.00"
                                ),
                                LocalDate.of(
                                        2026,
                                        9,
                                        10
                                )
                        ),
                        now
                );

        assertEquals(
                ControlTowerSeverity.CRITICAL,
                result.severity()
        );

        assertTrue(
                result.priorityScore()
                        .compareTo(
                                new BigDecimal(
                                        "80.00"
                                )
                        ) >= 0
        );
    }

    @Test
    void shouldUseEarlierSourceDueDateForSla() {
        LocalDate dueDate =
                LocalDate.of(
                        2026,
                        9,
                        15
                );

        ControlTowerPriorityResult result =
                service.evaluate(
                        source(
                                ControlTowerExceptionType.SOURCING_INITIATIVE_OVERDUE,
                                ControlTowerSeverity.MEDIUM,
                                BigDecimal.ZERO,
                                dueDate
                        ),
                        now
                );

        assertEquals(
                dueDate
                        .atStartOfDay(
                                ZoneOffset.UTC
                        )
                        .toInstant(),
                result.slaDueAt()
        );
    }

    private ControlTowerSourceException source(
            ControlTowerExceptionType type,
            ControlTowerSeverity severity,
            BigDecimal exposure,
            LocalDate dueDate
    ) {
        return new ControlTowerSourceException(
                type.name()
                        + ":"
                        + UUID.randomUUID(),
                type,
                "TEST",
                UUID.randomUUID(),
                "TEST",
                "Test exception",
                "Test exception details",
                severity,
                exposure,
                dueDate
        );
    }
}
