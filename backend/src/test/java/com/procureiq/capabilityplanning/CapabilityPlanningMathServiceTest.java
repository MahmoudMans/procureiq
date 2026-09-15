package com.procureiq.capabilityplanning;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CapabilityPlanningMathServiceTest {

    private CapabilityPlanningMathService service;

    @BeforeEach
    void setUp() {
        service =
                new CapabilityPlanningMathService();
    }

    @Test
    void shouldCalculateWeightedSkillFit() {
        BigDecimal result =
                service.weightedFit(
                        List.of(
                                new CapabilityRequirementFit(
                                        4,
                                        4,
                                        new BigDecimal(
                                                "60.00"
                                        )
                                ),
                                new CapabilityRequirementFit(
                                        4,
                                        2,
                                        new BigDecimal(
                                                "40.00"
                                        )
                                )
                        )
                );

        assertEquals(
                new BigDecimal(
                        "80.00"
                ),
                result
        );
    }

    @Test
    void shouldCapSkillFitAtOneHundred() {
        BigDecimal result =
                service.weightedFit(
                        List.of(
                                new CapabilityRequirementFit(
                                        3,
                                        5,
                                        new BigDecimal(
                                                "100.00"
                                        )
                                )
                        )
                );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                result
        );
    }

    @Test
    void shouldClassifyReadiness() {
        assertEquals(
                CapabilityReadiness.UNDEFINED,
                service.readiness(
                        false,
                        BigDecimal.ZERO
                )
        );

        assertEquals(
                CapabilityReadiness.READY,
                service.readiness(
                        true,
                        new BigDecimal(
                                "95.00"
                        )
                )
        );

        assertEquals(
                CapabilityReadiness.WATCH,
                service.readiness(
                        true,
                        new BigDecimal(
                                "80.00"
                        )
                )
        );

        assertEquals(
                CapabilityReadiness.GAP,
                service.readiness(
                        true,
                        new BigDecimal(
                                "60.00"
                        )
                )
        );

        assertEquals(
                CapabilityReadiness.CRITICAL,
                service.readiness(
                        true,
                        new BigDecimal(
                                "30.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculatePortfolioCapabilityScore() {
        CapabilityPortfolioScore score =
                service.portfolioScore(
                        4,
                        4,
                        List.of(
                                new BigDecimal(
                                        "80.00"
                                ),
                                new BigDecimal(
                                        "100.00"
                                ),
                                new BigDecimal(
                                        "60.00"
                                ),
                                new BigDecimal(
                                        "80.00"
                                )
                        ),
                        List.of(
                                new BigDecimal(
                                        "100.00"
                                ),
                                new BigDecimal(
                                        "100.00"
                                ),
                                new BigDecimal(
                                        "80.00"
                                ),
                                new BigDecimal(
                                        "100.00"
                                )
                        )
                );

        assertEquals(
                new BigDecimal(
                        "88.75"
                ),
                score.capabilityScore()
        );

        assertEquals(
                CapabilityReadiness.WATCH,
                score.health()
        );
    }
}
