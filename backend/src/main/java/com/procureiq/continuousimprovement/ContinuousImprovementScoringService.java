package com.procureiq.continuousimprovement;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class ContinuousImprovementScoringService {

    public ImprovementOpportunityScore opportunityScore(
            ImprovementMetricVector metric,
            BigDecimal totalExposure
    ) {
        BigDecimal overdueRate =
                rate(
                        metric.slaOverdueCount(),
                        metric.activeCount()
                );

        BigDecimal persistentRate =
                rate(
                        metric.persistentCount(),
                        metric.activeCount()
                );

        BigDecimal slaPenalty =
                metric.resolvedCount() == 0
                        ? zero()
                        : new BigDecimal(
                                "100.00"
                        )
                                .subtract(
                                        decimal(
                                                metric.slaAttainmentPct()
                                        )
                                )
                                .max(
                                        BigDecimal.ZERO
                                );

        BigDecimal workload =
                decimal(
                        metric.workloadSharePct()
                );

        BigDecimal exposureShare =
                exposureShare(
                        metric.activeExposure(),
                        totalExposure
                );

        BigDecimal score =
                overdueRate
                        .multiply(
                                new BigDecimal(
                                        "0.30"
                                )
                        )
                        .add(
                                persistentRate
                                        .multiply(
                                                new BigDecimal(
                                                        "0.25"
                                                )
                                        )
                        )
                        .add(
                                slaPenalty
                                        .multiply(
                                                new BigDecimal(
                                                        "0.20"
                                                )
                                        )
                        )
                        .add(
                                workload
                                        .multiply(
                                                new BigDecimal(
                                                        "0.15"
                                                )
                                        )
                        )
                        .add(
                                exposureShare
                                        .multiply(
                                                new BigDecimal(
                                                        "0.10"
                                                )
                                        )
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .min(
                                new BigDecimal(
                                        "100.00"
                                )
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        ImprovementPriority priority;

        if (
                score.compareTo(
                        new BigDecimal(
                                "75.00"
                        )
                ) >= 0
        ) {
            priority =
                    ImprovementPriority.CRITICAL;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "55.00"
                        )
                ) >= 0
        ) {
            priority =
                    ImprovementPriority.HIGH;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "35.00"
                        )
                ) >= 0
        ) {
            priority =
                    ImprovementPriority.MEDIUM;
        } else {
            priority =
                    ImprovementPriority.LOW;
        }

        return new ImprovementOpportunityScore(
                score,
                priority
        );
    }

    public ImprovementEvaluation evaluate(
            ImprovementMetricVector baseline,
            ImprovementMetricVector current,
            BigDecimal targetSlaAttainmentPct,
            BigDecimal targetSlaOverdueReductionPct,
            BigDecimal targetPersistentReductionPct,
            BigDecimal targetResolutionHoursReductionPct,
            BigDecimal targetExposureReductionPct
    ) {
        BigDecimal slaDelta =
                decimal(
                        current.slaAttainmentPct()
                )
                        .subtract(
                                decimal(
                                        baseline.slaAttainmentPct()
                                )
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal overdueReduction =
                reductionPct(
                        BigDecimal.valueOf(
                                baseline.slaOverdueCount()
                        ),
                        BigDecimal.valueOf(
                                current.slaOverdueCount()
                        )
                );

        BigDecimal persistentReduction =
                reductionPct(
                        BigDecimal.valueOf(
                                baseline.persistentCount()
                        ),
                        BigDecimal.valueOf(
                                current.persistentCount()
                        )
                );

        BigDecimal resolutionReduction =
                reductionPct(
                        baseline.avgResolutionHours(),
                        current.avgResolutionHours()
                );

        BigDecimal exposureReduction =
                reductionPct(
                        baseline.activeExposure(),
                        current.activeExposure()
                );

        int targetsMet =
                0;

        if (
                decimal(
                        current.slaAttainmentPct()
                )
                        .compareTo(
                                decimal(
                                        targetSlaAttainmentPct
                                )
                        )
                >= 0
        ) {
            targetsMet++;
        }

        if (
                overdueReduction.compareTo(
                        decimal(
                                targetSlaOverdueReductionPct
                        )
                ) >= 0
        ) {
            targetsMet++;
        }

        if (
                persistentReduction.compareTo(
                        decimal(
                                targetPersistentReductionPct
                        )
                ) >= 0
        ) {
            targetsMet++;
        }

        if (
                resolutionReduction.compareTo(
                        decimal(
                                targetResolutionHoursReductionPct
                        )
                ) >= 0
        ) {
            targetsMet++;
        }

        if (
                exposureReduction.compareTo(
                        decimal(
                                targetExposureReductionPct
                        )
                ) >= 0
        ) {
            targetsMet++;
        }

        BigDecimal score =
                slaTargetAchievement(
                        baseline.slaAttainmentPct(),
                        current.slaAttainmentPct(),
                        targetSlaAttainmentPct
                )
                        .add(
                                reductionAchievement(
                                        overdueReduction,
                                        targetSlaOverdueReductionPct
                                )
                        )
                        .add(
                                reductionAchievement(
                                        persistentReduction,
                                        targetPersistentReductionPct
                                )
                        )
                        .add(
                                reductionAchievement(
                                        resolutionReduction,
                                        targetResolutionHoursReductionPct
                                )
                        )
                        .add(
                                reductionAchievement(
                                        exposureReduction,
                                        targetExposureReductionPct
                                )
                        )
                        .divide(
                                new BigDecimal(
                                        "5.00"
                                ),
                                2,
                                RoundingMode.HALF_UP
                        )
                        .max(
                                new BigDecimal(
                                        "-100.00"
                                )
                        )
                        .min(
                                new BigDecimal(
                                        "100.00"
                                )
                        );

        ImprovementOutcome outcome;

        if (
                score.compareTo(
                        new BigDecimal(
                                "80.00"
                        )
                ) >= 0
        ) {
            outcome =
                    ImprovementOutcome.IMPROVED;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "20.00"
                        )
                ) >= 0
        ) {
            outcome =
                    ImprovementOutcome.MIXED;
        } else if (
                score.compareTo(
                        new BigDecimal(
                                "-20.00"
                        )
                ) > 0
        ) {
            outcome =
                    ImprovementOutcome.NO_CHANGE;
        } else {
            outcome =
                    ImprovementOutcome.REGRESSED;
        }

        return new ImprovementEvaluation(
                slaDelta,
                overdueReduction,
                persistentReduction,
                resolutionReduction,
                exposureReduction,
                targetsMet,
                score,
                outcome
        );
    }

    private BigDecimal rate(
            long numerator,
            long denominator
    ) {
        if (denominator <= 0) {
            return zero();
        }

        return BigDecimal
                .valueOf(
                        numerator
                )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        BigDecimal.valueOf(
                                denominator
                        ),
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        BigDecimal.ZERO
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                );
    }

    private BigDecimal exposureShare(
            BigDecimal exposure,
            BigDecimal total
    ) {
        BigDecimal denominator =
                money(
                        total
                );

        if (
                denominator.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return zero();
        }

        return money(
                exposure
        )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        denominator,
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        BigDecimal.ZERO
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                );
    }

    private BigDecimal reductionPct(
            BigDecimal baseline,
            BigDecimal current
    ) {
        BigDecimal base =
                decimal(
                        baseline
                );

        BigDecimal now =
                decimal(
                        current
                );

        if (
                base.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return now.compareTo(
                    BigDecimal.ZERO
            ) <= 0
                    ? new BigDecimal(
                            "100.00"
                    )
                    : new BigDecimal(
                            "-100.00"
                    );
        }

        return base
                .subtract(
                        now
                )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        base,
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        new BigDecimal(
                                "-100.00"
                        )
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                );
    }

    private BigDecimal slaTargetAchievement(
            BigDecimal baseline,
            BigDecimal current,
            BigDecimal target
    ) {
        BigDecimal base =
                decimal(
                        baseline
                );

        BigDecimal now =
                decimal(
                        current
                );

        BigDecimal targetValue =
                decimal(
                        target
                );

        if (
                now.compareTo(
                        targetValue
                ) >= 0
        ) {
            return new BigDecimal(
                    "100.00"
            );
        }

        BigDecimal required =
                targetValue
                        .subtract(
                                base
                        );

        if (
                required.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return now.compareTo(
                    targetValue
            ) >= 0
                    ? new BigDecimal(
                            "100.00"
                    )
                    : zero();
        }

        return now
                .subtract(
                        base
                )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        required,
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        new BigDecimal(
                                "-100.00"
                        )
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                );
    }

    private BigDecimal reductionAchievement(
            BigDecimal actual,
            BigDecimal target
    ) {
        BigDecimal normalizedTarget =
                decimal(
                        target
                );

        if (
                normalizedTarget.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return actual.compareTo(
                    BigDecimal.ZERO
            ) >= 0
                    ? new BigDecimal(
                            "100.00"
                    )
                    : new BigDecimal(
                            "-100.00"
                    );
        }

        return actual
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        normalizedTarget,
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        new BigDecimal(
                                "-100.00"
                        )
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                );
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        return decimal(
                value
        );
    }

    private BigDecimal decimal(
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

    private BigDecimal zero() {
        return BigDecimal.ZERO
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
