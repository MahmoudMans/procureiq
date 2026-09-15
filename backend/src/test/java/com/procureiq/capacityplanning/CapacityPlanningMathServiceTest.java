package com.procureiq.capacityplanning;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CapacityPlanningMathServiceTest {

    private CapacityPlanningMathService service;

    @BeforeEach
    void setUp() {
        service =
                new CapacityPlanningMathService();
    }

    @Test
    void shouldCalculateEffectiveCapacity() {
        assertEquals(
                new BigDecimal(
                        "1440.00"
                ),
                service.effectiveCapacity(
                        new BigDecimal(
                                "1800.00"
                        ),
                        new BigDecimal(
                                "20.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculateAssignmentHours() {
        assertEquals(
                new BigDecimal(
                        "60.00"
                ),
                service.assignmentHours(
                        new BigDecimal(
                                "120.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        )
                )
        );
    }

    @Test
    void shouldClassifyMemberHealth() {
        assertEquals(
                CapacityHealth.HEALTHY,
                service.memberHealth(
                        new BigDecimal(
                                "80.00"
                        )
                )
        );

        assertEquals(
                CapacityHealth.TIGHT,
                service.memberHealth(
                        new BigDecimal(
                                "95.00"
                        )
                )
        );

        assertEquals(
                CapacityHealth.OVERLOADED,
                service.memberHealth(
                        new BigDecimal(
                                "110.00"
                        )
                )
        );

        assertEquals(
                CapacityHealth.CRITICAL,
                service.memberHealth(
                        new BigDecimal(
                                "140.00"
                        )
                )
        );
    }

    @Test
    void shouldClassifyWorkPlanningStatus() {
        assertEquals(
                CapacityWorkStatus.UNESTIMATED,
                service.workStatus(
                        false,
                        BigDecimal.ZERO
                )
        );

        assertEquals(
                CapacityWorkStatus.UNASSIGNED,
                service.workStatus(
                        true,
                        BigDecimal.ZERO
                )
        );

        assertEquals(
                CapacityWorkStatus.PARTIAL,
                service.workStatus(
                        true,
                        new BigDecimal(
                                "75.00"
                        )
                )
        );

        assertEquals(
                CapacityWorkStatus.FULL,
                service.workStatus(
                        true,
                        new BigDecimal(
                                "100.00"
                        )
                )
        );
    }

    @Test
    void shouldProduceHealthyPortfolioForCoveredDemand() {
        CapacityScoreResult result =
                service.portfolioScore(
                        10,
                        10,
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "1200.00"
                        ),
                        0
                );

        assertEquals(
                CapacityHealth.HEALTHY,
                result.health()
        );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                result.capacityScore()
        );
    }

    @Test
    void shouldExposeCriticalPortfolioGap() {
        CapacityScoreResult result =
                service.portfolioScore(
                        10,
                        2,
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "200.00"
                        ),
                        new BigDecimal(
                                "200.00"
                        ),
                        7
                );

        assertEquals(
                CapacityHealth.CRITICAL,
                result.health()
        );
    }
}
