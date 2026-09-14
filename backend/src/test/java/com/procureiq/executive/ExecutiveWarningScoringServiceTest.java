package com.procureiq.executive;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ExecutiveWarningScoringServiceTest {

    private ExecutiveWarningScoringService service;

    @BeforeEach
    void setUp() {
        service =
                new ExecutiveWarningScoringService();
    }

    @Test
    void shouldRankHighExposureHighSeverityWarning() {
        assertEquals(
                new BigDecimal(
                        "80.00"
                ),
                service.priorityScore(
                        ExecutiveWarningSeverity.HIGH,
                        new BigDecimal(
                                "2.50"
                        ),
                        new BigDecimal(
                                "200000.00"
                        )
                )
        );
    }

    @Test
    void shouldCapCriticalPriorityAtOneHundred() {
        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                service.priorityScore(
                        ExecutiveWarningSeverity.CRITICAL,
                        new BigDecimal(
                                "3.00"
                        ),
                        new BigDecimal(
                                "500000.00"
                        )
                )
        );
    }

    @Test
    void shouldKeepInformationSignalLowPriority() {
        assertEquals(
                new BigDecimal(
                        "10.00"
                ),
                service.priorityScore(
                        ExecutiveWarningSeverity.INFO,
                        null,
                        null
                )
        );
    }
}
