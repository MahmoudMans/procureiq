package com.procureiq.benefitgovernance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BenefitValueMathServiceTest {

    private BenefitValueMathService service;

    @BeforeEach
    void setUp() {
        service =
                new BenefitValueMathService();
    }

    @Test
    void shouldCombineForecastGapAndLeakageIntoAtRiskValue() {
        assertEquals(
                new BigDecimal(
                        "30.00"
                ),
                service.atRiskAmount(
                        new BigDecimal(
                                "100.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        ),
                        new BigDecimal(
                                "10.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculateValidationCoverage() {
        assertEquals(
                new BigDecimal(
                        "75.00"
                ),
                service.coveragePct(
                        new BigDecimal(
                                "75.00"
                        ),
                        new BigDecimal(
                                "100.00"
                        )
                )
        );
    }

    @Test
    void shouldAllowOverDeliveryCoverageAboveOneHundred() {
        assertEquals(
                new BigDecimal(
                        "125.00"
                ),
                service.coveragePct(
                        new BigDecimal(
                                "125.00"
                        ),
                        new BigDecimal(
                                "100.00"
                        )
                )
        );
    }
}
