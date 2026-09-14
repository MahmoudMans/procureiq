package com.procureiq.negotiation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class NegotiationCalculationServiceTest {

    private NegotiationCalculationService service;

    @BeforeEach
    void setUp() {
        service =
                new NegotiationCalculationService();
    }

    @Test
    void shouldCalculateSavings() {
        assertEquals(
                new BigDecimal(
                        "15000.00"
                ),
                service.savings(
                        new BigDecimal(
                                "100000.00"
                        ),
                        new BigDecimal(
                                "85000.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculateSavingsPercentage() {
        assertEquals(
                new BigDecimal(
                        "15.00"
                ),
                service.savingsPercentage(
                        new BigDecimal(
                                "100000.00"
                        ),
                        new BigDecimal(
                                "85000.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculateScenarioScore() {
        assertEquals(
                new BigDecimal(
                        "55.00"
                ),
                service.scenarioScore(
                        new BigDecimal(
                                "100000.00"
                        ),
                        new BigDecimal(
                                "90000.00"
                        ),
                        60,
                        30,
                        18
                )
        );
    }

    @Test
    void shouldRejectNegativeTerms() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.scenarioScore(
                                new BigDecimal(
                                        "100000.00"
                                ),
                                new BigDecimal(
                                        "90000.00"
                                ),
                                -1,
                                30,
                                18
                        )
        );
    }
}
