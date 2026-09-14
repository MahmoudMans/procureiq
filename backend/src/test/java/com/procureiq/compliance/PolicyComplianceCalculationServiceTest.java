package com.procureiq.compliance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PolicyComplianceCalculationServiceTest {

    private PolicyComplianceCalculationService service;

    @BeforeEach
    void setUp() {
        service =
                new PolicyComplianceCalculationService();
    }

    @Test
    void shouldReturnFullComplianceWhenNoViolationsExist() {
        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                service.resolutionRate(
                        0,
                        0,
                        0
                )
        );
    }

    @Test
    void shouldCalculateResolutionRate() {
        assertEquals(
                new BigDecimal(
                        "70.00"
                ),
                service.resolutionRate(
                        10,
                        2,
                        1
                )
        );
    }

    @Test
    void shouldNeverUseNegativeResolvedCount() {
        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                service.resolutionRate(
                        2,
                        2,
                        2
                )
        );
    }
}
