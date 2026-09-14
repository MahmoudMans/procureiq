package com.procureiq.supplierperformance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SupplierPerformanceScoringServiceTest {

    private SupplierPerformanceScoringService service;

    @BeforeEach
    void setUp() {
        service =
                new SupplierPerformanceScoringService();
    }

    @Test
    void shouldCalculateWeightedScore() {
        assertEquals(
                new BigDecimal(
                        "83.50"
                ),
                service.weightedScore(
                        new BigDecimal(
                                "90"
                        ),
                        new BigDecimal(
                                "80"
                        ),
                        new BigDecimal(
                                "85"
                        ),
                        new BigDecimal(
                                "75"
                        ),
                        new BigDecimal(
                                "85"
                        )
                )
        );
    }

    @Test
    void shouldClassifyBands() {
        assertEquals(
                SupplierPerformanceBand.EXCELLENT,
                service.band(
                        new BigDecimal(
                                "90"
                        )
                )
        );

        assertEquals(
                SupplierPerformanceBand.GOOD,
                service.band(
                        new BigDecimal(
                                "75"
                        )
                )
        );

        assertEquals(
                SupplierPerformanceBand.NEEDS_IMPROVEMENT,
                service.band(
                        new BigDecimal(
                                "60"
                        )
                )
        );

        assertEquals(
                SupplierPerformanceBand.CRITICAL,
                service.band(
                        new BigDecimal(
                                "40"
                        )
                )
        );
    }

    @Test
    void shouldRejectInvalidScore() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.weightedScore(
                                new BigDecimal(
                                        "101"
                                ),
                                new BigDecimal(
                                        "80"
                                ),
                                new BigDecimal(
                                        "80"
                                ),
                                new BigDecimal(
                                        "80"
                                ),
                                new BigDecimal(
                                        "80"
                                )
                        )
        );
    }
}
