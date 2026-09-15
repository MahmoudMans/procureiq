package com.procureiq.strategyrecovery;

import com.procureiq.strategyexecution.ExecutionCommitmentHealth;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StrategyRecoveryMathServiceTest {

    private StrategyRecoveryMathService service;

    @BeforeEach
    void setUp() {
        service =
                new StrategyRecoveryMathService();
    }

    @Test
    void blockedCommitmentShouldHaveHighRisk() {
        BigDecimal risk =
                service.riskScore(
                        ExecutionCommitmentHealth.BLOCKED,
                        2,
                        new BigDecimal(
                                "10.00"
                        ),
                        new BigDecimal(
                                "5.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "68.00"
                ),
                risk
        );

        assertEquals(
                RecoverySeverity.HIGH,
                service.severity(
                        risk
                )
        );
    }

    @Test
    void majorRiskReductionShouldShowImprovement() {
        RecoveryMetricResult result =
                service.recovery(
                        new BigDecimal(
                                "80.00"
                        ),
                        new BigDecimal(
                                "30.00"
                        ),
                        false
                );

        assertEquals(
                new BigDecimal(
                        "62.50"
                ),
                result.effectivenessPct()
        );

        assertEquals(
                RecoveryHealth.IMPROVING,
                result.recoveryHealth()
        );
    }

    @Test
    void eligibleLowRiskCaseShouldBeRecovered() {
        RecoveryMetricResult result =
                service.recovery(
                        new BigDecimal(
                                "70.00"
                        ),
                        new BigDecimal(
                                "10.00"
                        ),
                        true
                );

        assertEquals(
                RecoveryHealth.RECOVERED,
                result.recoveryHealth()
        );

        assertEquals(
                new BigDecimal(
                        "90.00"
                ),
                result.recoveryScore()
        );
    }

    @Test
    void weakRecoveryShouldRemainIneffective() {
        RecoveryMetricResult result =
                service.recovery(
                        new BigDecimal(
                                "80.00"
                        ),
                        new BigDecimal(
                                "70.00"
                        ),
                        false
                );

        assertEquals(
                RecoveryHealth.INEFFECTIVE,
                result.recoveryHealth()
        );
    }

    @Test
    void portfolioShouldReflectAverageEffectiveness() {
        RecoveryHealth health =
                service.portfolioHealth(
                        List.of(
                                new RecoveryMetricResult(
                                        new BigDecimal(
                                                "30.00"
                                        ),
                                        new BigDecimal(
                                                "70.00"
                                        ),
                                        new BigDecimal(
                                                "60.00"
                                        ),
                                        RecoveryHealth.IMPROVING
                                ),
                                new RecoveryMetricResult(
                                        new BigDecimal(
                                                "40.00"
                                        ),
                                        new BigDecimal(
                                                "60.00"
                                        ),
                                        new BigDecimal(
                                                "50.00"
                                        ),
                                        RecoveryHealth.IMPROVING
                                )
                        )
                );

        assertEquals(
                RecoveryHealth.IMPROVING,
                health
        );
    }
}
