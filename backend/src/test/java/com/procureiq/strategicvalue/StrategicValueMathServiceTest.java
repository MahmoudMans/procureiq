package com.procureiq.strategicvalue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class StrategicValueMathServiceTest {

    private StrategicValueMathService service;

    @BeforeEach
    void setUp() {
        service =
                new StrategicValueMathService();
    }

    @Test
    void shouldCalculateDurableValueRoiAndPayback() {
        StrategicValueMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "100.00"
                        ),
                        new BigDecimal(
                                "1200.00"
                        ),
                        24,
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        ),
                        new BigDecimal(
                                "18.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "2400.00"
                ),
                result.baselineHorizonValueAmount()
        );

        assertEquals(
                new BigDecimal(
                        "2160.00"
                ),
                result.durableHorizonValueAmount()
        );

        assertEquals(
                new BigDecimal(
                        "240.00"
                ),
                result.decayedValueAmount()
        );

        assertEquals(
                new BigDecimal(
                        "1200.00"
                ),
                result.totalCostAmount()
        );

        assertEquals(
                new BigDecimal(
                        "960.00"
                ),
                result.netValueAmount()
        );

        assertEquals(
                new BigDecimal(
                        "80.00"
                ),
                result.roiPct()
        );

        assertEquals(
                new BigDecimal(
                        "12.24"
                ),
                result.paybackMonths()
        );

        assertEquals(
                StrategicValueHealth.STRONG,
                result.health()
        );
    }

    @Test
    void shouldDetectNegativeRoi() {
        StrategicValueMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "400.00"
                        ),
                        new BigDecimal(
                                "300.00"
                        ),
                        12,
                        new BigDecimal(
                                "50.00"
                        ),
                        new BigDecimal(
                                "20.00"
                        ),
                        new BigDecimal(
                                "24.00"
                        )
                );

        assertEquals(
                StrategicValueHealth.AT_RISK,
                result.health()
        );

        assertNull(
                result.paybackMonths()
        );
    }

    @Test
    void shouldNeverTreatDecayAsDurableValue() {
        StrategicValueMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "500.00"
                        ),
                        BigDecimal.ZERO,
                        new BigDecimal(
                                "1000.00"
                        ),
                        12,
                        new BigDecimal(
                                "60.00"
                        ),
                        BigDecimal.ZERO,
                        new BigDecimal(
                                "24.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "600.00"
                ),
                result.durableHorizonValueAmount()
        );

        assertEquals(
                new BigDecimal(
                        "400.00"
                ),
                result.valueAtRiskAmount()
        );
    }

    @Test
    void shouldCalculatePortfolioHealth() {
        assertEquals(
                StrategicValueHealth.HEALTHY,
                service.portfolioHealth(
                        new BigDecimal(
                                "30.00"
                        ),
                        List.of(
                                StrategicValueHealth.STRONG,
                                StrategicValueHealth.HEALTHY
                        )
                )
        );
    }
}
