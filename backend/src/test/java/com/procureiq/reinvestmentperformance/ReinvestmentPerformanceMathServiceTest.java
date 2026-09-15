package com.procureiq.reinvestmentperformance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReinvestmentPerformanceMathServiceTest {

    private ReinvestmentPerformanceMathService service;

    @BeforeEach
    void setUp() {
        service =
                new ReinvestmentPerformanceMathService();
    }

    @Test
    void shouldCalculateOutperformingRealization() {
        ReinvestmentPerformanceMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        ),
                        12,
                        new BigDecimal(
                                "100.00"
                        ),
                        new BigDecimal(
                                "1800.00"
                        ),
                        true
                );

        assertEquals(
                new BigDecimal(
                        "1100.00"
                ),
                result.totalCostAmount()
        );

        assertEquals(
                new BigDecimal(
                        "1650.00"
                ),
                result.expectedHorizonValueAmount()
        );

        assertEquals(
                new BigDecimal(
                        "1800.00"
                ),
                result.realizedHorizonValueAmount()
        );

        assertEquals(
                new BigDecimal(
                        "700.00"
                ),
                result.realizedNetValueAmount()
        );

        assertEquals(
                new BigDecimal(
                        "63.64"
                ),
                result.realizedRoiPct()
        );

        assertEquals(
                ReinvestmentPerformanceHealth.OUTPERFORMING,
                result.health()
        );
    }

    @Test
    void shouldDetectWatchPerformance() {
        ReinvestmentPerformanceMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        ),
                        12,
                        BigDecimal.ZERO,
                        new BigDecimal(
                                "1350.00"
                        ),
                        true
                );

        assertEquals(
                ReinvestmentPerformanceHealth.WATCH,
                result.health()
        );
    }

    @Test
    void shouldDetectUnderperformance() {
        ReinvestmentPerformanceMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        ),
                        12,
                        BigDecimal.ZERO,
                        new BigDecimal(
                                "500.00"
                        ),
                        true
                );

        assertEquals(
                ReinvestmentPerformanceHealth.UNDERPERFORMING,
                result.health()
        );
    }

    @Test
    void shouldRemainUnassessedWithoutValidatedEvidence() {
        ReinvestmentPerformanceMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        ),
                        12,
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        false
                );

        assertEquals(
                ReinvestmentPerformanceHealth.UNASSESSED,
                result.health()
        );
    }
}
