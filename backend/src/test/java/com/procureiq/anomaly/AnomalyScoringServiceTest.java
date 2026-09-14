package com.procureiq.anomaly;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AnomalyScoringServiceTest {

    private AnomalyScoringService service;

    @BeforeEach
    void setUp() {
        service =
                new AnomalyScoringService();
    }

    @Test
    void shouldScoreHighSeverityMaterialExposure() {
        assertEquals(
                new BigDecimal(
                        "80.00"
                ),
                service.score(
                        AnomalySeverity.HIGH,
                        new BigDecimal(
                                "10.00"
                        ),
                        new BigDecimal(
                                "3.00"
                        ),
                        new BigDecimal(
                                "15000.00"
                        )
                )
        );
    }

    @Test
    void shouldCapCriticalAnomalyAtOneHundred() {
        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                service.score(
                        AnomalySeverity.CRITICAL,
                        new BigDecimal(
                                "25.00"
                        ),
                        new BigDecimal(
                                "5.00"
                        ),
                        new BigDecimal(
                                "250000.00"
                        )
                )
        );
    }

    @Test
    void shouldKeepLowSignalLower() {
        assertEquals(
                new BigDecimal(
                        "25.00"
                ),
                service.score(
                        AnomalySeverity.LOW,
                        new BigDecimal(
                                "5.00"
                        ),
                        BigDecimal.ONE,
                        BigDecimal.ZERO
                )
        );
    }
}
