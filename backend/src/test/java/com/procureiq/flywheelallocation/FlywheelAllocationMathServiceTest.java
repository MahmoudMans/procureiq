package com.procureiq.flywheelallocation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class FlywheelAllocationMathServiceTest {

    private FlywheelAllocationMathService service;

    @BeforeEach
    void setUp() {
        service =
                new FlywheelAllocationMathService();
    }

    @Test
    void shouldCalculateRequestedAndRemainingCapacity() {
        FlywheelAllocationMetricResult result =
                service.calculate(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                new BigDecimal(
                                        "300.00"
                                ),
                                new BigDecimal(
                                        "450.00"
                                )
                        )
                );

        assertEquals(
                new BigDecimal(
                        "750.00"
                ),
                result.requestedAllocationAmount()
        );

        assertEquals(
                new BigDecimal(
                        "250.00"
                ),
                result.remainingStrategyCapacityAmount()
        );

        assertEquals(
                new BigDecimal(
                        "75.00"
                ),
                result.allocationUtilizationPct()
        );
    }

    @Test
    void shouldReturnZeroMetricsForEmptyMandate() {
        FlywheelAllocationMetricResult result =
                service.calculate(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of()
                );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                result.requestedAllocationAmount()
        );

        assertEquals(
                new BigDecimal(
                        "1000.00"
                ),
                result.remainingStrategyCapacityAmount()
        );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                result.allocationUtilizationPct()
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
