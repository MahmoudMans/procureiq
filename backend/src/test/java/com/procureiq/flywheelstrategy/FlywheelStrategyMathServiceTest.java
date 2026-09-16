package com.procureiq.flywheelstrategy;

import com.procureiq.capitalflywheel.CapitalFlywheelHealth;
import com.procureiq.capitalflywheel.CapitalFlywheelRecommendation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class FlywheelStrategyMathServiceTest {

    private FlywheelStrategyMathService service;

    @BeforeEach
    void setUp() {
        service =
                new FlywheelStrategyMathService();
    }

    @Test
    void shouldPrioritizeStrongCompoundingFlywheel() {
        FlywheelStrategyPriorityResult result =
                service.priority(
                        new FlywheelStrategyPriorityInput(
                                new BigDecimal("2.20"),
                                new BigDecimal("0.90"),
                                new BigDecimal("120.00"),
                                false,
                                CapitalFlywheelHealth.COMPOUNDING,
                                CapitalFlywheelRecommendation.CONTINUE
                        )
                );

        assertEquals(
                FlywheelStrategyAdvisory.PRIORITIZE,
                result.advisoryRecommendation()
        );

        assertEquals(
                new BigDecimal("96.50"),
                result.priorityScore()
        );
    }

    @Test
    void shouldHoldDiminishingFlywheel() {
        FlywheelStrategyPriorityResult result =
                service.priority(
                        new FlywheelStrategyPriorityInput(
                                new BigDecimal("1.80"),
                                new BigDecimal("0.70"),
                                new BigDecimal("75.00"),
                                true,
                                CapitalFlywheelHealth.DIMINISHING,
                                CapitalFlywheelRecommendation.HOLD
                        )
                );

        assertEquals(
                FlywheelStrategyAdvisory.HOLD,
                result.advisoryRecommendation()
        );
    }

    @Test
    void shouldExitStoppedAndExhaustedFlywheel() {
        FlywheelStrategyPriorityResult result =
                service.priority(
                        new FlywheelStrategyPriorityInput(
                                new BigDecimal("0.20"),
                                new BigDecimal("0.05"),
                                new BigDecimal("20.00"),
                                true,
                                CapitalFlywheelHealth.EXHAUSTED,
                                CapitalFlywheelRecommendation.STOP
                        )
                );

        assertEquals(
                FlywheelStrategyAdvisory.EXIT,
                result.advisoryRecommendation()
        );
    }

    @Test
    void shouldCalculatePortfolioCapacity() {
        FlywheelStrategyPortfolioMetricResult result =
                service.portfolio(
                        new BigDecimal("1000.00"),
                        List.of(
                                new BigDecimal("400.00"),
                                new BigDecimal("350.00")
                        ),
                        List.of(
                                new BigDecimal("90.00"),
                                new BigDecimal("70.00")
                        )
                );

        assertEquals(
                new BigDecimal("750.00"),
                result.prioritizedCapacityAmount()
        );

        assertEquals(
                new BigDecimal("250.00"),
                result.remainingCapacityAmount()
        );

        assertEquals(
                new BigDecimal("75.00"),
                result.capacityUtilizationPct()
        );

        assertEquals(
                new BigDecimal("80.00"),
                result.averagePriorityScore()
        );
    }

    @Test
    void shouldClampPriorityInputsWithoutChangingEvidencePercentageFormatter() {
        FlywheelStrategyPriorityResult result =
                service.priority(
                        new FlywheelStrategyPriorityInput(
                                new BigDecimal("9.00"),
                                new BigDecimal("4.00"),
                                new BigDecimal("175.00"),
                                false,
                                CapitalFlywheelHealth.COMPOUNDING,
                                CapitalFlywheelRecommendation.CONTINUE
                        )
                );

        assertEquals(
                new BigDecimal("100.00"),
                result.priorityScore()
        );

        assertEquals(
                new BigDecimal("175.00"),
                service.percent(
                        new BigDecimal("175")
                )
        );
    }
}
