package com.procureiq.budget;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BudgetCalculationServiceTest {

    private BudgetCalculationService
            service;

    @BeforeEach
    void setUp() {
        service =
                new BudgetCalculationService();
    }

    @Test
    void shouldCalculateUtilization() {
        assertEquals(
                new BigDecimal("75.00"),
                service.utilizationPercent(
                        new BigDecimal(
                                "75000.00"
                        ),
                        new BigDecimal(
                                "100000.00"
                        )
                )
        );
    }

    @Test
    void shouldClassifyWarningAndExceeded() {
        assertEquals(
                BudgetAlertLevel.HEALTHY,
                service.alertLevel(
                        new BigDecimal(
                                "74.99"
                        ),
                        new BigDecimal(
                                "80.00"
                        )
                )
        );

        assertEquals(
                BudgetAlertLevel.WARNING,
                service.alertLevel(
                        new BigDecimal(
                                "80.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        )
                )
        );

        assertEquals(
                BudgetAlertLevel.EXCEEDED,
                service.alertLevel(
                        new BigDecimal(
                                "100.01"
                        ),
                        new BigDecimal(
                                "80.00"
                        )
                )
        );
    }

    @Test
    void shouldAllowNegativeRemainingWhenForecastExceedsBudget() {
        assertEquals(
                new BigDecimal(
                        "-2500.00"
                ),
                service.remaining(
                        new BigDecimal(
                                "10000.00"
                        ),
                        new BigDecimal(
                                "12500.00"
                        )
                )
        );
    }
}
