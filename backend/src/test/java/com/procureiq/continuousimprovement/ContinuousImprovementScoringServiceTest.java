package com.procureiq.continuousimprovement;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContinuousImprovementScoringServiceTest {

    private ContinuousImprovementScoringService service;

    @BeforeEach
    void setUp() {
        service =
                new ContinuousImprovementScoringService();
    }

    @Test
    void shouldRankSeverePersistentBottleneckHigh() {
        ImprovementMetricVector metric =
                new ImprovementMetricVector(
                        10,
                        8,
                        7,
                        10,
                        new BigDecimal(
                                "40.00"
                        ),
                        new BigDecimal(
                                "120.00"
                        ),
                        new BigDecimal(
                                "15.00"
                        ),
                        new BigDecimal(
                                "80000.00"
                        ),
                        new BigDecimal(
                                "60.00"
                        )
                );

        ImprovementOpportunityScore result =
                service.opportunityScore(
                        metric,
                        new BigDecimal(
                                "100000.00"
                        )
                );

        assertTrue(
                result.score()
                        .compareTo(
                                new BigDecimal(
                                        "55.00"
                                )
                        ) >= 0
        );

        assertTrue(
                result.priority()
                        == ImprovementPriority.HIGH
                ||
                result.priority()
                        == ImprovementPriority.CRITICAL
        );
    }

    @Test
    void shouldClassifyStrongTargetAchievementAsImproved() {
        ImprovementMetricVector baseline =
                new ImprovementMetricVector(
                        10,
                        8,
                        6,
                        10,
                        new BigDecimal(
                                "50.00"
                        ),
                        new BigDecimal(
                                "100.00"
                        ),
                        new BigDecimal(
                                "10.00"
                        ),
                        new BigDecimal(
                                "100000.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        )
                );

        ImprovementMetricVector current =
                new ImprovementMetricVector(
                        4,
                        2,
                        1,
                        12,
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        ),
                        new BigDecimal(
                                "4.00"
                        ),
                        new BigDecimal(
                                "40000.00"
                        ),
                        new BigDecimal(
                                "20.00"
                        )
                );

        ImprovementEvaluation result =
                service.evaluate(
                        baseline,
                        current,
                        new BigDecimal(
                                "85.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        ),
                        new BigDecimal(
                                "30.00"
                        ),
                        new BigDecimal(
                                "30.00"
                        )
                );

        assertEquals(
                ImprovementOutcome.IMPROVED,
                result.outcome()
        );

        assertEquals(
                5,
                result.targetsMetCount()
        );
    }

    @Test
    void shouldClassifyMaterialRegressionAsRegressed() {
        ImprovementMetricVector baseline =
                new ImprovementMetricVector(
                        5,
                        1,
                        1,
                        10,
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "30.00"
                        ),
                        new BigDecimal(
                                "3.00"
                        ),
                        new BigDecimal(
                                "10000.00"
                        ),
                        new BigDecimal(
                                "20.00"
                        )
                );

        ImprovementMetricVector current =
                new ImprovementMetricVector(
                        10,
                        5,
                        6,
                        5,
                        new BigDecimal(
                                "40.00"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "12.00"
                        ),
                        new BigDecimal(
                                "50000.00"
                        ),
                        new BigDecimal(
                                "40.00"
                        )
                );

        ImprovementEvaluation result =
                service.evaluate(
                        baseline,
                        current,
                        new BigDecimal(
                                "95.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        ),
                        new BigDecimal(
                                "50.00"
                        ),
                        new BigDecimal(
                                "30.00"
                        ),
                        new BigDecimal(
                                "30.00"
                        )
                );

        assertEquals(
                ImprovementOutcome.REGRESSED,
                result.outcome()
        );
    }
}
