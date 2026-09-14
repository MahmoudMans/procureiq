package com.procureiq.categorymanagement;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CategoryOpportunityServiceTest {

    private CategoryOpportunityService service;

    @BeforeEach
    void setUp() {
        service =
                new CategoryOpportunityService();
    }

    @Test
    void shouldModelFragmentedCategoryAtFivePercent() {
        assertEquals(
                new BigDecimal(
                        "5.00"
                ),
                service.modeledOpportunityPct(
                        7,
                        new BigDecimal(
                                "32.00"
                        )
                )
        );

        assertEquals(
                new BigDecimal(
                        "50000.00"
                ),
                service.modeledOpportunityAmount(
                        new BigDecimal(
                                "1000000.00"
                        ),
                        7,
                        new BigDecimal(
                                "32.00"
                        )
                )
        );
    }

    @Test
    void shouldPutHighValueHighRiskCategoryInCriticalPriority() {
        assertEquals(
                CategoryMatrixPosition.CRITICAL_PRIORITY,
                service.matrixPosition(
                        new BigDecimal(
                                "80.00"
                        ),
                        new BigDecimal(
                                "65.00"
                        )
                )
        );
    }

    @Test
    void shouldCapStrategicValueAtOneHundred() {
        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                service.strategicValueScore(
                        new BigDecimal(
                                "2500000.00"
                        ),
                        10
                )
        );
    }
}
