package com.procureiq.fundingexecution;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FundingExecutionMathServiceTest {

    private FundingExecutionMathService service;

    @BeforeEach
    void setUp() {
        service =
                new FundingExecutionMathService();
    }

    @Test
    void shouldCalculateFundingMetrics() {
        FundingMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "800.00"
                        ),
                        new BigDecimal(
                                "800.00"
                        ),
                        new BigDecimal(
                                "300.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "200.00"
                ),
                result.remainingAuthorizationAmount()
        );

        assertEquals(
                new BigDecimal(
                        "500.00"
                ),
                result.remainingCommitmentAmount()
        );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                result.plannedCoveragePct()
        );

        assertEquals(
                new BigDecimal(
                        "37.50"
                ),
                result.releasePct()
        );
    }

    @Test
    void shouldRequireExactFundingPlanBeforeActivation() {
        assertTrue(
                service.exactFundingPlan(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "1000.00"
                        )
                )
        );

        assertFalse(
                service.exactFundingPlan(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "900.00"
                        )
                )
        );
    }
}
