package com.procureiq.savings;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SavingsCalculationServiceTest {

    private SavingsCalculationService service;

    @BeforeEach
    void setUp() {
        service =
                new SavingsCalculationService();
    }

    @Test
    void shouldCalculateTargetSavings() {
        assertEquals(
                new BigDecimal("25000.00"),
                service.targetSavings(
                        new BigDecimal("125000.00"),
                        new BigDecimal("100000.00")
                )
        );
    }

    @Test
    void shouldRejectNegativeSavings() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.targetSavings(
                                new BigDecimal("9000.00"),
                                new BigDecimal("10000.00")
                        )
        );
    }

    @Test
    void shouldCalculateRealizationRate() {
        assertEquals(
                new BigDecimal("75.00"),
                service.realizationRate(
                        new BigDecimal("15000.00"),
                        new BigDecimal("20000.00")
                )
        );
    }

    @Test
    void shouldCalculateRemainingSavings() {
        assertEquals(
                new BigDecimal("5000.00"),
                service.remaining(
                        new BigDecimal("20000.00"),
                        new BigDecimal("15000.00")
                )
        );
    }
}
