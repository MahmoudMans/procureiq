package com.procureiq.successionplanning;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class SuccessionPlanningMathService {

    public BigDecimal proficiencyFit(
            int requiredProficiency,
            int currentProficiency
    ) {
        int required =
                Math.max(
                        1,
                        requiredProficiency
                );

        int current =
                Math.max(
                        0,
                        currentProficiency
                );

        return BigDecimal
                .valueOf(
                        current
                )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        BigDecimal.valueOf(
                                required
                        ),
                        2,
                        RoundingMode.HALF_UP
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .max(
                        BigDecimal.ZERO
                );
    }

    public BigDecimal availabilityScore(
            BigDecimal utilizationPct
    ) {
        BigDecimal utilization =
                decimal(
                        utilizationPct
                );

        if (
                utilization.compareTo(
                        new BigDecimal(
                                "85.00"
                        )
                ) <= 0
        ) {
            return new BigDecimal(
                    "100.00"
            );
        }

        if (
                utilization.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) <= 0
        ) {
            return new BigDecimal(
                    "80.00"
            );
        }

        if (
                utilization.compareTo(
                        new BigDecimal(
                                "120.00"
                        )
                ) <= 0
        ) {
            return new BigDecimal(
                    "40.00"
            );
        }

        return new BigDecimal(
                "10.00"
        );
    }

    public BigDecimal candidateEvidenceScore(
            int requiredProficiency,
            int currentProficiency,
            BigDecimal utilizationPct
    ) {
        return proficiencyFit(
                requiredProficiency,
                currentProficiency
        )
                .multiply(
                        new BigDecimal(
                                "0.80"
                        )
                )
                .add(
                        availabilityScore(
                                utilizationPct
                        )
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
                        BigDecimal.ZERO
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                );
    }

    public SuccessionCandidateReadiness candidateReadiness(
            int requiredProficiency,
            int currentProficiency
    ) {
        BigDecimal fit =
                proficiencyFit(
                        requiredProficiency,
                        currentProficiency
                );

        if (
                fit.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) >= 0
        ) {
            return SuccessionCandidateReadiness.READY;
        }

        if (
                fit.compareTo(
                        new BigDecimal(
                                "75.00"
                        )
                ) >= 0
        ) {
            return SuccessionCandidateReadiness.NEAR_READY;
        }

        if (
                fit.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return SuccessionCandidateReadiness.DEVELOPING;
        }

        return SuccessionCandidateReadiness.GAP;
    }

    public SuccessionPolicyScore policyScore(
            SuccessionCriticality criticality,
            int targetReadyPeople,
            int readyPeople,
            boolean singlePointFailure
    ) {
        BigDecimal coverage =
                percent(
                        BigDecimal.valueOf(
                                readyPeople
                        ),
                        BigDecimal.valueOf(
                                Math.max(
                                        1,
                                        targetReadyPeople
                                )
                        )
                );

        BigDecimal penalty =
                BigDecimal.ZERO;

        if (singlePointFailure) {
            penalty =
                    penalty.add(
                            new BigDecimal(
                                    "25.00"
                            )
                    );
        }

        if (
                criticality
                        == SuccessionCriticality.CRITICAL
                &&
                readyPeople == 0
        ) {
            penalty =
                    penalty.add(
                            new BigDecimal(
                                    "25.00"
                            )
                    );
        }

        BigDecimal score =
                coverage
                        .subtract(
                                penalty
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

        return new SuccessionPolicyScore(
                coverage,
                score,
                health(
                        score,
                        false
                )
        );
    }

    public SuccessionPortfolioScore portfolioScore(
            int policyCount,
            int coveredPolicyCount,
            List<BigDecimal> policyScores,
            int singlePointFailureCount,
            int criticalExposureCount
    ) {
        if (policyCount <= 0) {
            return new SuccessionPortfolioScore(
                    BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            ),
                    BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            ),
                    BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            ),
                    SuccessionHealth.UNDEFINED
            );
        }

        BigDecimal coverage =
                percent(
                        BigDecimal.valueOf(
                                coveredPolicyCount
                        ),
                        BigDecimal.valueOf(
                                policyCount
                        )
                );

        BigDecimal average =
                average(
                        policyScores
                );

        BigDecimal singlePointPenalty =
                percent(
                        BigDecimal.valueOf(
                                singlePointFailureCount
                        ),
                        BigDecimal.valueOf(
                                policyCount
                        )
                )
                        .multiply(
                                new BigDecimal(
                                        "0.20"
                                )
                        );

        BigDecimal criticalPenalty =
                percent(
                        BigDecimal.valueOf(
                                criticalExposureCount
                        ),
                        BigDecimal.valueOf(
                                policyCount
                        )
                )
                        .multiply(
                                new BigDecimal(
                                        "0.20"
                                )
                        );

        BigDecimal score =
                average
                        .multiply(
                                new BigDecimal(
                                        "0.70"
                                )
                        )
                        .add(
                                coverage
                                        .multiply(
                                                new BigDecimal(
                                                        "0.30"
                                                )
                                        )
                        )
                        .subtract(
                                singlePointPenalty
                        )
                        .subtract(
                                criticalPenalty
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

        return new SuccessionPortfolioScore(
                coverage,
                average,
                score,
                health(
                        score,
                        false
                )
        );
    }

    public SuccessionHealth health(
            BigDecimal score,
            boolean undefined
    ) {
        if (undefined) {
            return SuccessionHealth.UNDEFINED;
        }

        BigDecimal normalized =
                decimal(
                        score
                );

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "90.00"
                        )
                ) >= 0
        ) {
            return SuccessionHealth.RESILIENT;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "75.00"
                        )
                ) >= 0
        ) {
            return SuccessionHealth.STABLE;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return SuccessionHealth.WATCH;
        }

        return SuccessionHealth.CRITICAL;
    }

    public BigDecimal average(
            List<BigDecimal> values
    ) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
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

    private BigDecimal percent(
            BigDecimal numerator,
            BigDecimal denominator
    ) {
        BigDecimal denominatorValue =
                decimal(
                        denominator
                );

        if (
                denominatorValue.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return decimal(
                numerator
        )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        denominatorValue,
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
}
