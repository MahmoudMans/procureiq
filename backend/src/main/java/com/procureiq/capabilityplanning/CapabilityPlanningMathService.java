package com.procureiq.capabilityplanning;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class CapabilityPlanningMathService {

    public BigDecimal weightedFit(
            List<CapabilityRequirementFit> requirements
    ) {
        if (requirements.isEmpty()) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        BigDecimal totalWeight =
                requirements.stream()
                        .map(
                                CapabilityRequirementFit::
                                        weightPct
                        )
                        .map(
                                this::decimal
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        if (
                totalWeight.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        BigDecimal weighted =
                requirements.stream()
                        .map(
                                requirement -> {
                                    BigDecimal required =
                                            BigDecimal.valueOf(
                                                    Math.max(
                                                            1,
                                                            requirement.requiredProficiency()
                                                    )
                                            );

                                    BigDecimal available =
                                            BigDecimal.valueOf(
                                                    Math.max(
                                                            0,
                                                            requirement.availableProficiency()
                                                    )
                                            );

                                    BigDecimal fit =
                                            available
                                                    .multiply(
                                                            new BigDecimal(
                                                                    "100.00"
                                                            )
                                                    )
                                                    .divide(
                                                            required,
                                                            4,
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

                                    return fit.multiply(
                                            decimal(
                                                    requirement.weightPct()
                                            )
                                    );
                                }
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return weighted
                .divide(
                        totalWeight,
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

    public CapabilityReadiness readiness(
            boolean requirementsDefined,
            BigDecimal score
    ) {
        if (!requirementsDefined) {
            return CapabilityReadiness.UNDEFINED;
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
            return CapabilityReadiness.READY;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "75.00"
                        )
                ) >= 0
        ) {
            return CapabilityReadiness.WATCH;
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return CapabilityReadiness.GAP;
        }

        return CapabilityReadiness.CRITICAL;
    }

    public CapabilityPortfolioScore portfolioScore(
            int strategicWorkCount,
            int workWithRequirements,
            List<BigDecimal> assignedScores,
            List<BigDecimal> benchScores
    ) {
        BigDecimal requirementCoverage =
                percent(
                        BigDecimal.valueOf(
                                workWithRequirements
                        ),
                        BigDecimal.valueOf(
                                strategicWorkCount
                        )
                );

        BigDecimal assigned =
                average(
                        assignedScores
                );

        BigDecimal bench =
                average(
                        benchScores
                );

        BigDecimal score =
                requirementCoverage
                        .multiply(
                                new BigDecimal(
                                        "0.25"
                                )
                        )
                        .add(
                                assigned
                                        .multiply(
                                                new BigDecimal(
                                                        "0.50"
                                                )
                                        )
                        )
                        .add(
                                bench
                                        .multiply(
                                                new BigDecimal(
                                                        "0.25"
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

        CapabilityReadiness health =
                strategicWorkCount == 0
                        ? CapabilityReadiness.UNDEFINED
                        : readiness(
                                true,
                                score
                        );

        return new CapabilityPortfolioScore(
                requirementCoverage,
                assigned,
                bench,
                score,
                health
        );
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
