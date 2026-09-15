package com.procureiq.strategyscenario;

import com.procureiq.strategycockpit.BoardDimensionKey;
import com.procureiq.strategycockpit.BoardHealth;
import com.procureiq.strategycockpit.BoardMovement;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StrategyScenarioMathServiceTest {

    private StrategyScenarioMathService service;

    @BeforeEach
    void setUp() {
        service =
                new StrategyScenarioMathService();
    }

    @Test
    void shouldApplyPositiveAdjustment() {
        assertEquals(
                new BigDecimal(
                        "82.00"
                ),
                service.applyAdjustment(
                        new BigDecimal(
                                "70.00"
                        ),
                        new BigDecimal(
                                "12.00"
                        )
                )
        );
    }

    @Test
    void shouldBoundScenarioScore() {
        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                service.applyAdjustment(
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "25.00"
                        )
                )
        );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                service.applyAdjustment(
                        new BigDecimal(
                                "20.00"
                        ),
                        new BigDecimal(
                                "-50.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculateBoardWeightedScenario() {
        BigDecimal overall =
                service.overallScore(
                        List.of(
                                service.dimension(
                                        BoardDimensionKey.OBJECTIVE_EXECUTION,
                                        new BigDecimal(
                                                "70.00"
                                        ),
                                        new BigDecimal(
                                                "10.00"
                                        )
                                ),
                                service.dimension(
                                        BoardDimensionKey.STRATEGIC_ALIGNMENT,
                                        new BigDecimal(
                                                "80.00"
                                        ),
                                        BigDecimal.ZERO
                                ),
                                service.dimension(
                                        BoardDimensionKey.CAPACITY_READINESS,
                                        new BigDecimal(
                                                "60.00"
                                        ),
                                        new BigDecimal(
                                                "10.00"
                                        )
                                ),
                                service.dimension(
                                        BoardDimensionKey.CAPABILITY_READINESS,
                                        new BigDecimal(
                                                "50.00"
                                        ),
                                        new BigDecimal(
                                                "20.00"
                                        )
                                ),
                                service.dimension(
                                        BoardDimensionKey.SUCCESSION_RESILIENCE,
                                        new BigDecimal(
                                                "70.00"
                                        ),
                                        BigDecimal.ZERO
                                )
                        )
                );

        assertEquals(
                new BigDecimal(
                        "74.50"
                ),
                overall
        );
    }

    @Test
    void shouldClassifyScenarioHealthAndMovement() {
        assertEquals(
                BoardHealth.STRONG,
                service.health(
                        new BigDecimal(
                                "74.50"
                        )
                )
        );

        assertEquals(
                BoardMovement.IMPROVING,
                service.movement(
                        new BigDecimal(
                                "74.50"
                        ),
                        new BigDecimal(
                                "68.00"
                        )
                )
        );

        assertEquals(
                BoardMovement.STABLE,
                service.movement(
                        new BigDecimal(
                                "69.00"
                        ),
                        new BigDecimal(
                                "68.00"
                        )
                )
        );

        assertEquals(
                BoardMovement.DETERIORATING,
                service.movement(
                        new BigDecimal(
                                "64.00"
                        ),
                        new BigDecimal(
                                "68.00"
                        )
                )
        );
    }

    @Test
    void shouldExposeCorrectBoardWeights() {
        BigDecimal total =
                service.weight(
                        BoardDimensionKey.OBJECTIVE_EXECUTION
                )
                        .add(
                                service.weight(
                                        BoardDimensionKey.STRATEGIC_ALIGNMENT
                                )
                        )
                        .add(
                                service.weight(
                                        BoardDimensionKey.CAPACITY_READINESS
                                )
                        )
                        .add(
                                service.weight(
                                        BoardDimensionKey.CAPABILITY_READINESS
                                )
                        )
                        .add(
                                service.weight(
                                        BoardDimensionKey.SUCCESSION_RESILIENCE
                                )
                        );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                total
        );
    }
}
