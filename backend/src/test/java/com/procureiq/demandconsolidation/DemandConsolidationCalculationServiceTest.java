package com.procureiq.demandconsolidation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DemandConsolidationCalculationServiceTest {

    private DemandConsolidationCalculationService service;

    @BeforeEach
    void setUp() {
        service =
                new DemandConsolidationCalculationService();
    }

    @Test
    void shouldEstimateLeverageFromValueDepartmentsAndIntakes() {
        assertEquals(
                new BigDecimal(
                        "8.00"
                ),
                service.leveragePercentage(
                        new BigDecimal(
                                "120000.00"
                        ),
                        3,
                        4
                )
        );
    }

    @Test
    void shouldEstimateSavingsFromLeverage() {
        assertEquals(
                new BigDecimal(
                        "9600.00"
                ),
                service.expectedSavings(
                        new BigDecimal(
                                "120000.00"
                        ),
                        new BigDecimal(
                                "8.00"
                        )
                )
        );
    }

    @Test
    void shouldCapLeverageAtFifteenPercent() {
        assertEquals(
                new BigDecimal(
                        "15.00"
                ),
                service.leveragePercentage(
                        new BigDecimal(
                                "1000000.00"
                        ),
                        10,
                        20
                )
        );
    }

    @Test
    void shouldRejectSingleDepartmentConsolidation() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        service.leveragePercentage(
                                new BigDecimal(
                                        "50000.00"
                                ),
                                1,
                                2
                        )
        );
    }
}
