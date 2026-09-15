package com.procureiq.strategyroadmap;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StrategyRoadmapMathServiceTest {

    private StrategyRoadmapMathService service;

    @BeforeEach
    void setUp() {
        service =
                new StrategyRoadmapMathService();
    }

    @Test
    void shouldReturnUndefinedWithoutInitiatives() {
        RoadmapReadinessResult result =
                service.readiness(
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0
                );

        assertEquals(
                RoadmapReadinessHealth.UNDEFINED,
                result.health()
        );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                result.readinessScore()
        );
    }

    @Test
    void shouldReturnReadyForHealthyRoadmap() {
        RoadmapReadinessResult result =
                service.readiness(
                        4,
                        4,
                        3,
                        3,
                        6,
                        6,
                        2,
                        2,
                        0
                );

        assertEquals(
                RoadmapReadinessHealth.READY,
                result.health()
        );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                result.readinessScore()
        );
    }

    @Test
    void shouldPenalizeDependencyAndMilestoneRisk() {
        RoadmapReadinessResult result =
                service.readiness(
                        4,
                        4,
                        4,
                        2,
                        4,
                        2,
                        2,
                        2,
                        0
                );

        assertEquals(
                new BigDecimal(
                        "72.50"
                ),
                result.readinessScore()
        );

        assertEquals(
                RoadmapReadinessHealth.WATCH,
                result.health()
        );
    }

    @Test
    void rejectedGateShouldBlockRoadmap() {
        RoadmapReadinessResult result =
                service.readiness(
                        2,
                        2,
                        0,
                        0,
                        0,
                        0,
                        1,
                        0,
                        1
                );

        assertEquals(
                RoadmapReadinessHealth.BLOCKED,
                result.health()
        );
    }
}
