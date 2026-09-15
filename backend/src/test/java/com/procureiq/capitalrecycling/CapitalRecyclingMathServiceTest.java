package com.procureiq.capitalrecycling;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CapitalRecyclingMathServiceTest {

    private CapitalRecyclingMathService service;

    @BeforeEach
    void setUp() {
        service =
                new CapitalRecyclingMathService();
    }

    @Test
    void shouldCapRecyclableCapitalByCurrentFundingRemaining() {
        assertEquals(
                new BigDecimal(
                        "600.00"
                ),
                service.recyclableCapital(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "600.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculateAvailableAndUtilization() {
        CapitalRecyclingMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "400.00"
                        ),
                        new BigDecimal(
                                "200.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "400.00"
                ),
                result.availableCapitalAmount()
        );

        assertEquals(
                new BigDecimal(
                        "40.00"
                ),
                result.utilizationPct()
        );
    }

    @Test
    void shouldNeverExposeNegativeAvailableCapital() {
        CapitalRecyclingMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "900.00"
                        ),
                        new BigDecimal(
                                "200.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                result.availableCapitalAmount()
        );
    }
}
