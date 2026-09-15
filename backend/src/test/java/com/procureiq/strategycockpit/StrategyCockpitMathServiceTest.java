package com.procureiq.strategycockpit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StrategyCockpitMathServiceTest {

    private StrategyCockpitMathService service;

    @BeforeEach
    void setUp() {
        service =
                new StrategyCockpitMathService();
    }

    @Test
    void shouldCalculateWeightedBoardScore() {
        BigDecimal score =
                service.weightedScore(
                        List.of(
                                new WeightedBoardDimension(
                                        BoardDimensionKey.OBJECTIVE_EXECUTION,
                                        new BigDecimal(
                                                "80.00"
                                        ),
                                        new BigDecimal(
                                                "25.00"
                                        )
                                ),
                                new WeightedBoardDimension(
                                        BoardDimensionKey.STRATEGIC_ALIGNMENT,
                                        new BigDecimal(
                                                "90.00"
                                        ),
                                        new BigDecimal(
                                                "20.00"
                                        )
                                ),
                                new WeightedBoardDimension(
                                        BoardDimensionKey.CAPACITY_READINESS,
                                        new BigDecimal(
                                                "70.00"
                                        ),
                                        new BigDecimal(
                                                "20.00"
                                        )
                                ),
                                new WeightedBoardDimension(
                                        BoardDimensionKey.CAPABILITY_READINESS,
                                        new BigDecimal(
                                                "60.00"
                                        ),
                                        new BigDecimal(
                                                "20.00"
                                        )
                                ),
                                new WeightedBoardDimension(
                                        BoardDimensionKey.SUCCESSION_RESILIENCE,
                                        new BigDecimal(
                                                "100.00"
                                        ),
                                        new BigDecimal(
                                                "15.00"
                                        )
                                )
                        )
                );

        assertEquals(
                new BigDecimal(
                        "79.00"
                ),
                score
        );
    }

    @Test
    void shouldClassifyBoardHealth() {
        assertEquals(
                BoardHealth.EXCELLENT,
                service.health(
                        new BigDecimal(
                                "90.00"
                        )
                )
        );

        assertEquals(
                BoardHealth.STRONG,
                service.health(
                        new BigDecimal(
                                "75.00"
                        )
                )
        );

        assertEquals(
                BoardHealth.WATCH,
                service.health(
                        new BigDecimal(
                                "55.00"
                        )
                )
        );

        assertEquals(
                BoardHealth.CRITICAL,
                service.health(
                        new BigDecimal(
                                "40.00"
                        )
                )
        );
    }

    @Test
    void shouldClassifyMovement() {
        assertEquals(
                BoardMovement.BASELINE,
                service.movement(
                        new BigDecimal(
                                "80.00"
                        ),
                        null
                )
        );

        assertEquals(
                BoardMovement.IMPROVING,
                service.movement(
                        new BigDecimal(
                                "83.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        )
                )
        );

        assertEquals(
                BoardMovement.STABLE,
                service.movement(
                        new BigDecimal(
                                "81.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        )
                )
        );

        assertEquals(
                BoardMovement.DETERIORATING,
                service.movement(
                        new BigDecimal(
                                "77.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        )
                )
        );
    }
}
