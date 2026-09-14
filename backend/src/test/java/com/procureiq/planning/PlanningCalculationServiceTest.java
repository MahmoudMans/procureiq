package com.procureiq.planning;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PlanningCalculationServiceTest {

    private PlanningCalculationService
            service;

    @BeforeEach
    void setUp() {
        service =
                new PlanningCalculationService();
    }

    @Test
    void shouldCalculatePlanVariance() {
        assertEquals(
                new BigDecimal(
                        "2500.00"
                ),
                service.variance(
                        new BigDecimal(
                                "10000.00"
                        ),
                        new BigDecimal(
                                "12500.00"
                        )
                )
        );

        assertEquals(
                new BigDecimal(
                        "-2000.00"
                ),
                service.variance(
                        new BigDecimal(
                                "10000.00"
                        ),
                        new BigDecimal(
                                "8000.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculateConversionRate() {
        assertEquals(
                new BigDecimal(
                        "75.00"
                ),
                service.conversionRate(
                        3,
                        4
                )
        );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                service.conversionRate(
                        0,
                        0
                )
        );
    }
}
