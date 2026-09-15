package com.procureiq.strategyrecovery;

import com.procureiq.strategyexecution.ExecutionCommitmentHealth;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class StrategyRecoveryMathService {

    public BigDecimal riskScore(
            ExecutionCommitmentHealth health,
            int blockerCount,
            BigDecimal plannedContributionPoints,
            BigDecimal valueAtRiskPoints
    ) {
        BigDecimal healthRisk =
                healthRisk(
                        health
                );

        BigDecimal blockerRisk =
                BigDecimal.valueOf(
                        Math.min(
                                Math.max(
                                        blockerCount,
                                        0
                                )
                                        * 10L,
                                100L
                        )
                )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal planned =
                decimal(
                        plannedContributionPoints
                );

        BigDecimal valueAtRisk =
                decimal(
                        valueAtRiskPoints
                );

        BigDecimal valueRisk;

        if (
                planned.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            valueRisk =
                    valueAtRisk.compareTo(
                            BigDecimal.ZERO
                    ) > 0
                            ? hundred()
                            : zero();
        } else {
            valueRisk =
                    valueAtRisk
                            .multiply(
                                    hundred()
                            )
                            .divide(
                                    planned,
                                    2,
                                    RoundingMode.HALF_UP
                            )
                            .max(
                                    zero()
                            )
                            .min(
                                    hundred()
                            );
        }

        return healthRisk
                .multiply(
                        new BigDecimal(
                                "0.60"
                        )
                )
                .add(
                        blockerRisk
                                .multiply(
                                        new BigDecimal(
                                                "0.20"
                                        )
                                )
                )
                .add(
                        valueRisk
                                .multiply(
                                        new BigDecimal(
                                                "0.20"
                                        )
                                )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        zero()
                )
                .min(
                        hundred()
                );
    }

    public RecoverySeverity severity(
            BigDecimal riskScore
    ) {
        BigDecimal risk =
                bounded(
                        riskScore
                );

        if (
                risk.compareTo(
                        new BigDecimal(
                                "75.00"
                        )
                ) >= 0
        ) {
            return RecoverySeverity.CRITICAL;
        }

        if (
                risk.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return RecoverySeverity.HIGH;
        }

        return RecoverySeverity.MEDIUM;
    }

    public RecoveryMetricResult recovery(
            BigDecimal baselineRiskScore,
            BigDecimal currentRiskScore,
            boolean verificationEligible
    ) {
        BigDecimal baseline =
                bounded(
                        baselineRiskScore
                );

        BigDecimal current =
                bounded(
                        currentRiskScore
                );

        BigDecimal recoveryScore =
                hundred()
                        .subtract(
                                current
                        )
                        .max(
                                zero()
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal effectiveness;

        if (
                baseline.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            effectiveness =
                    current.compareTo(
                            BigDecimal.ZERO
                    ) <= 0
                            ? hundred()
                            : zero();
        } else {
            effectiveness =
                    baseline
                            .subtract(
                                    current
                            )
                            .max(
                                    zero()
                            )
                            .multiply(
                                    hundred()
                            )
                            .divide(
                                    baseline,
                                    2,
                                    RoundingMode.HALF_UP
                            )
                            .max(
                                    zero()
                            )
                            .min(
                                    hundred()
                            );
        }

        RecoveryHealth health;

        if (
                verificationEligible
                &&
                current.compareTo(
                        new BigDecimal(
                                "15.00"
                        )
                ) <= 0
        ) {
            health =
                    RecoveryHealth.RECOVERED;
        } else if (
                effectiveness.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            health =
                    RecoveryHealth.IMPROVING;
        } else if (
                effectiveness.compareTo(
                        new BigDecimal(
                                "20.00"
                        )
                ) >= 0
        ) {
            health =
                    RecoveryHealth.WATCH;
        } else {
            health =
                    RecoveryHealth.INEFFECTIVE;
        }

        return new RecoveryMetricResult(
                current,
                recoveryScore,
                effectiveness,
                health
        );
    }

    public RecoveryHealth portfolioHealth(
            List<RecoveryMetricResult> metrics
    ) {
        if (metrics.isEmpty()) {
            return RecoveryHealth.RECOVERED;
        }

        BigDecimal average =
                metrics.stream()
                        .map(
                                RecoveryMetricResult::
                                        effectivenessPct
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .divide(
                                BigDecimal.valueOf(
                                        metrics.size()
                                ),
                                2,
                                RoundingMode.HALF_UP
                        );

        boolean recovered =
                metrics.stream()
                        .allMatch(
                                metric ->
                                        metric.recoveryHealth()
                                                == RecoveryHealth.RECOVERED
                        );

        if (recovered) {
            return RecoveryHealth.RECOVERED;
        }

        if (
                average.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return RecoveryHealth.IMPROVING;
        }

        if (
                average.compareTo(
                        new BigDecimal(
                                "20.00"
                        )
                ) >= 0
        ) {
            return RecoveryHealth.WATCH;
        }

        return RecoveryHealth.INEFFECTIVE;
    }

    public BigDecimal average(
            List<BigDecimal> values
    ) {
        if (values.isEmpty()) {
            return zero();
        }

        return values.stream()
                .map(
                        this::decimal
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .divide(
                        BigDecimal.valueOf(
                                values.size()
                        ),
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal decimal(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal bounded(
            BigDecimal value
    ) {
        return decimal(
                value
        )
                .max(
                        zero()
                )
                .min(
                        hundred()
                );
    }

    private BigDecimal healthRisk(
            ExecutionCommitmentHealth health
    ) {
        return switch (
                health
        ) {
            case COMPLETED,
                 CANCELLED ->
                    zero();

            case ON_TRACK ->
                    new BigDecimal(
                            "10.00"
                    );

            case NOT_STARTED ->
                    new BigDecimal(
                            "20.00"
                    );

            case WATCH ->
                    new BigDecimal(
                            "40.00"
                    );

            case AT_RISK ->
                    new BigDecimal(
                            "70.00"
                    );

            case BLOCKED ->
                    new BigDecimal(
                            "90.00"
                    );

            case OVERDUE ->
                    hundred();
        };
    }

    private BigDecimal zero() {
        return BigDecimal.ZERO
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal hundred() {
        return new BigDecimal(
                "100.00"
        );
    }
}
