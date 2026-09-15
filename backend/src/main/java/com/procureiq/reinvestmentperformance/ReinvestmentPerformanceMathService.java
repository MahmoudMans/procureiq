package com.procureiq.reinvestmentperformance;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class ReinvestmentPerformanceMathService {

    public ReinvestmentPerformanceMetricResult metrics(
            BigDecimal redeployedCapitalAmount,
            BigDecimal baselineTargetRoiPct,
            int measurementHorizonMonths,
            BigDecimal annualOperatingCostAmount,
            BigDecimal validatedRealizedAnnualizedValueAmount,
            boolean assessed
    ) {
        BigDecimal redeployed =
                money(
                        redeployedCapitalAmount
                );

        if (!assessed) {
            return new ReinvestmentPerformanceMetricResult(
                    redeployed,
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    ReinvestmentPerformanceHealth.UNASSESSED
            );
        }

        BigDecimal horizonYears =
                BigDecimal.valueOf(
                        measurementHorizonMonths
                )
                        .divide(
                                new BigDecimal(
                                        "12.00"
                                ),
                                8,
                                RoundingMode.HALF_UP
                        );

        BigDecimal operatingCostHorizon =
                money(
                        annualOperatingCostAmount
                )
                        .multiply(
                                horizonYears
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal totalCost =
                redeployed
                        .add(
                                operatingCostHorizon
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal targetRoi =
                decimal(
                        baselineTargetRoiPct
                );

        BigDecimal expectedMultiplier =
                BigDecimal.ONE
                        .add(
                                targetRoi.divide(
                                        hundred(),
                                        8,
                                        RoundingMode.HALF_UP
                                )
                        )
                        .max(
                                BigDecimal.ZERO
                        );

        BigDecimal expectedHorizonValue =
                totalCost
                        .multiply(
                                expectedMultiplier
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal realizedHorizonValue =
                money(
                        validatedRealizedAnnualizedValueAmount
                )
                        .multiply(
                                horizonYears
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal realizedNetValue =
                realizedHorizonValue
                        .subtract(
                                totalCost
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal realizedRoi =
                totalCost.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zero()
                        : realizedNetValue
                                .multiply(
                                        hundred()
                                )
                                .divide(
                                        totalCost,
                                        2,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal roiVariance =
                realizedRoi
                        .subtract(
                                targetRoi
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal valueVariance =
                realizedHorizonValue
                        .subtract(
                                expectedHorizonValue
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal realizationPct =
                expectedHorizonValue.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zero()
                        : realizedHorizonValue
                                .multiply(
                                        hundred()
                                )
                                .divide(
                                        expectedHorizonValue,
                                        2,
                                        RoundingMode.HALF_UP
                                )
                                .max(
                                        zero()
                                )
                                .min(
                                        new BigDecimal(
                                                "999.99"
                                        )
                                );

        ReinvestmentPerformanceHealth health =
                health(
                        targetRoi,
                        realizedRoi,
                        realizationPct
                );

        return new ReinvestmentPerformanceMetricResult(
                redeployed,
                operatingCostHorizon,
                totalCost,
                expectedHorizonValue,
                realizedHorizonValue,
                realizedNetValue,
                realizedRoi,
                roiVariance,
                valueVariance,
                realizationPct,
                health
        );
    }

    public ReinvestmentPerformanceHealth health(
            BigDecimal baselineTargetRoiPct,
            BigDecimal realizedRoiPct,
            BigDecimal realizationPct
    ) {
        BigDecimal target =
                decimal(
                        baselineTargetRoiPct
                );

        BigDecimal realized =
                decimal(
                        realizedRoiPct
                );

        BigDecimal realization =
                decimal(
                        realizationPct
                );

        if (
                realized.compareTo(
                        target
                ) >= 0
                &&
                realization.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) >= 0
        ) {
            return ReinvestmentPerformanceHealth.OUTPERFORMING;
        }

        BigDecimal target90 =
                target.signum() >= 0
                        ? target.multiply(
                                new BigDecimal(
                                        "0.90"
                                )
                        )
                        : target;

        if (
                realized.compareTo(
                        target90
                ) >= 0
                &&
                realization.compareTo(
                        new BigDecimal(
                                "90.00"
                        )
                ) >= 0
        ) {
            return ReinvestmentPerformanceHealth.ON_TRACK;
        }

        BigDecimal target70 =
                target.signum() >= 0
                        ? target.multiply(
                                new BigDecimal(
                                        "0.70"
                                )
                        )
                        : target;

        if (
                realized.compareTo(
                        target70
                ) >= 0
                &&
                realization.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            return ReinvestmentPerformanceHealth.WATCH;
        }

        return ReinvestmentPerformanceHealth.UNDERPERFORMING;
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

    public BigDecimal money(
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
