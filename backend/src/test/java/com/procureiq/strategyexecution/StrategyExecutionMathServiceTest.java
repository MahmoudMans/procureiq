package com.procureiq.strategyexecution;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StrategyExecutionMathServiceTest {

    private StrategyExecutionMathService service;

    @BeforeEach
    void setUp() {
        service =
                new StrategyExecutionMathService();
    }

    @Test
    void shouldCalculateExpectedProgress() {
        assertEquals(
                new BigDecimal(
                        "50.00"
                ),
                service.expectedProgress(
                        LocalDate.of(
                                2026,
                                1,
                                1
                        ),
                        LocalDate.of(
                                2026,
                                1,
                                11
                        ),
                        LocalDate.of(
                                2026,
                                1,
                                6
                        )
                )
        );
    }

    @Test
    void blockerShouldOverrideScheduleHealth() {
        assertEquals(
                ExecutionCommitmentHealth.BLOCKED,
                service.commitmentHealth(
                        ExecutionCommitmentStatus.IN_PROGRESS,
                        new BigDecimal(
                                "80.00"
                        ),
                        LocalDate.of(
                                2026,
                                1,
                                1
                        ),
                        LocalDate.of(
                                2026,
                                12,
                                31
                        ),
                        LocalDate.of(
                                2026,
                                12,
                                31
                        ),
                        1,
                        LocalDate.of(
                                2026,
                                6,
                                1
                        )
                )
        );
    }

    @Test
    void shouldDetectForecastRisk() {
        assertEquals(
                ExecutionCommitmentHealth.AT_RISK,
                service.commitmentHealth(
                        ExecutionCommitmentStatus.IN_PROGRESS,
                        new BigDecimal(
                                "75.00"
                        ),
                        LocalDate.of(
                                2026,
                                1,
                                1
                        ),
                        LocalDate.of(
                                2026,
                                12,
                                31
                        ),
                        LocalDate.of(
                                2027,
                                2,
                                1
                        ),
                        0,
                        LocalDate.of(
                                2026,
                                7,
                                1
                        )
                )
        );
    }

    @Test
    void shouldSeparateValidatedOutcomeFromPlannedContribution() {
        ExecutionPortfolioResult result =
                service.portfolio(
                        List.of(
                                new ExecutionCommitmentMetric(
                                        ExecutionCommitmentStatus.COMPLETED,
                                        ExecutionCommitmentHealth.COMPLETED,
                                        new BigDecimal(
                                                "100.00"
                                        ),
                                        new BigDecimal(
                                                "10.00"
                                        ),
                                        new BigDecimal(
                                                "5.00"
                                        )
                                )
                        )
                );

        assertEquals(
                new BigDecimal(
                        "50.00"
                ),
                result.outcomeValidationPct()
        );

        assertEquals(
                new BigDecimal(
                        "5.00"
                ),
                result.valueAtRiskPoints()
        );
    }

    @Test
    void shouldCalculatePortfolioExecutionScore() {
        ExecutionPortfolioResult result =
                service.portfolio(
                        List.of(
                                new ExecutionCommitmentMetric(
                                        ExecutionCommitmentStatus.COMPLETED,
                                        ExecutionCommitmentHealth.COMPLETED,
                                        new BigDecimal(
                                                "100.00"
                                        ),
                                        new BigDecimal(
                                                "10.00"
                                        ),
                                        new BigDecimal(
                                                "10.00"
                                        )
                                ),
                                new ExecutionCommitmentMetric(
                                        ExecutionCommitmentStatus.IN_PROGRESS,
                                        ExecutionCommitmentHealth.ON_TRACK,
                                        new BigDecimal(
                                                "50.00"
                                        ),
                                        new BigDecimal(
                                                "10.00"
                                        ),
                                        BigDecimal.ZERO
                                )
                        )
                );

        assertEquals(
                new BigDecimal(
                        "88.75"
                ),
                result.executionScore()
        );

        assertEquals(
                ExecutionPortfolioHealth.HEALTHY,
                result.health()
        );
    }
}
