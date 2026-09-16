package com.procureiq.flywheelrelease;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class FlywheelReleaseMathServiceTest {

    private FlywheelReleaseMathService service;

    @BeforeEach
    void setUp() {
        service =
                new FlywheelReleaseMathService();
    }

    @Test
    void shouldCalculateBatchAndCumulativeReleaseMetrics() {
        FlywheelReleaseMetricResult result =
                service.calculate(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                new BigDecimal(
                                        "300.00"
                                ),
                                new BigDecimal(
                                        "200.00"
                                )
                        ),
                        List.of(
                                new BigDecimal(
                                        "300.00"
                                )
                        ),
                        new BigDecimal(
                                "650.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "500.00"
                ),
                result.batchPlannedReleaseAmount()
        );

        assertEquals(
                new BigDecimal(
                        "300.00"
                ),
                result.batchReleasedAmount()
        );

        assertEquals(
                new BigDecimal(
                        "650.00"
                ),
                result.cumulativeMandateReleasedAmount()
        );

        assertEquals(
                new BigDecimal(
                        "350.00"
                ),
                result.remainingMandateAmount()
        );

        assertEquals(
                new BigDecimal(
                        "65.00"
                ),
                result.cumulativeReleaseUtilizationPct()
        );
    }

    @Test
    void shouldNeverExposeNegativeRemainingAmount() {
        FlywheelReleaseMetricResult result =
                service.calculate(
                        new BigDecimal(
                                "500.00"
                        ),
                        List.of(),
                        List.of(),
                        new BigDecimal(
                                "700.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                result.remainingMandateAmount()
        );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                result.cumulativeReleaseUtilizationPct()
        );
    }

    @Test
    void shouldCalculateEmptyReleaseBatch() {
        FlywheelReleaseMetricResult result =
                service.calculate(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(),
                        List.of(),
                        BigDecimal.ZERO
                );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                result.batchPlannedReleaseAmount()
        );

        assertEquals(
                new BigDecimal(
                        "1000.00"
                ),
                result.remainingMandateAmount()
        );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                result.cumulativeReleaseUtilizationPct()
        );
    }

    @Test
    void shouldNormalizeMoneyScale() {
        assertEquals(
                new BigDecimal(
                        "10.13"
                ),
                service.money(
                        new BigDecimal(
                                "10.126"
                        )
                )
        );
    }
}
