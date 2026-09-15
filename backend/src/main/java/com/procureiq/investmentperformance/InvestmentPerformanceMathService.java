package com.procureiq.investmentperformance;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class InvestmentPerformanceMathService {

    public InvestmentPerformanceMetricResult metrics(
            BigDecimal baselineInvestmentCostAmount,
            BigDecimal baselineAnnualOperatingCostAmount,
            BigDecimal baselineDurableHorizonValueAmount,
            BigDecimal baselineRoiPct,
            int valueHorizonMonths,
            BigDecimal releasedCapitalAmount,
            BigDecimal validatedRealizedAnnualizedValueAmount,
            boolean assessed
    ) {
        BigDecimal released =
                money(
                        releasedCapitalAmount
                );

        if (!assessed) {
            return new InvestmentPerformanceMetricResult(
                    released,
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    zero(),
                    zeroFour(),
                    zero(),
                    InvestmentPerformanceHealth.UNASSESSED
            );
        }

        BigDecimal baselineInvestment =
                money(
                        baselineInvestmentCostAmount
                );

        BigDecimal annualOperatingCost =
                money(
                        baselineAnnualOperatingCostAmount
                );

        BigDecimal baselineDurableValue =
                money(
                        baselineDurableHorizonValueAmount
                );

        BigDecimal realizedAnnualValue =
                money(
                        validatedRealizedAnnualizedValueAmount
                );

        BigDecimal horizonYears =
                BigDecimal.valueOf(
                        valueHorizonMonths
                )
                        .divide(
                                new BigDecimal(
                                        "12.00"
                                ),
                                8,
                                RoundingMode.HALF_UP
                        );

        BigDecimal realizedHorizonValue =
                realizedAnnualValue
                        .multiply(
                                horizonYears
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal operatingCostHorizon =
                annualOperatingCost
                        .multiply(
                                horizonYears
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal realizedTotalCost =
                released
                        .add(
                                operatingCostHorizon
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal realizedNetValue =
                realizedHorizonValue
                        .subtract(
                                realizedTotalCost
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal realizedRoi =
                realizedTotalCost.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zero()
                        : realizedNetValue
                                .multiply(
                                        hundred()
                                )
                                .divide(
                                        realizedTotalCost,
                                        2,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal fundingVariance =
                released
                        .subtract(
                                baselineInvestment
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal fundingVariancePct =
                baselineInvestment.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zero()
                        : fundingVariance
                                .multiply(
                                        hundred()
                                )
                                .divide(
                                        baselineInvestment,
                                        2,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal roiVariance =
                realizedRoi
                        .subtract(
                                decimal(
                                        baselineRoiPct
                                )
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal capitalEfficiency =
                released.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zeroFour()
                        : realizedHorizonValue
                                .divide(
                                        released,
                                        4,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal valueVariance =
                realizedHorizonValue
                        .subtract(
                                baselineDurableValue
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        InvestmentPerformanceHealth health =
                health(
                        realizedRoi,
                        decimal(
                                baselineRoiPct
                        ),
                        realizedHorizonValue,
                        baselineDurableValue
                );

        return new InvestmentPerformanceMetricResult(
                released,
                fundingVariance,
                fundingVariancePct,
                realizedHorizonValue,
                operatingCostHorizon,
                realizedTotalCost,
                realizedNetValue,
                realizedRoi,
                roiVariance,
                capitalEfficiency,
                valueVariance,
                health
        );
    }

    public InvestmentPerformanceHealth health(
            BigDecimal realizedRoiPct,
            BigDecimal baselineRoiPct,
            BigDecimal realizedHorizonValue,
            BigDecimal baselineDurableHorizonValue
    ) {
        BigDecimal realizedRoi =
                decimal(
                        realizedRoiPct
                );

        BigDecimal baselineRoi =
                decimal(
                        baselineRoiPct
                );

        BigDecimal realizedValue =
                money(
                        realizedHorizonValue
                );

        BigDecimal baselineValue =
                money(
                        baselineDurableHorizonValue
                );

        if (
                realizedRoi.compareTo(
                        baselineRoi
                ) >= 0
                &&
                realizedValue.compareTo(
                        baselineValue
                ) >= 0
        ) {
            return InvestmentPerformanceHealth.OUTPERFORMING;
        }

        if (
                realizedRoi.compareTo(
                        baselineRoi.multiply(
                                new BigDecimal(
                                        "0.90"
                                )
                        )
                ) >= 0
                &&
                realizedValue.compareTo(
                        baselineValue.multiply(
                                new BigDecimal(
                                        "0.90"
                                )
                        )
                ) >= 0
        ) {
            return InvestmentPerformanceHealth.ON_TRACK;
        }

        if (
                realizedRoi.compareTo(
                        BigDecimal.ZERO
                ) >= 0
                &&
                realizedValue.compareTo(
                        baselineValue.multiply(
                                new BigDecimal(
                                        "0.70"
                                )
                        )
                ) >= 0
        ) {
            return InvestmentPerformanceHealth.WATCH;
        }

        return InvestmentPerformanceHealth.UNDERPERFORMING;
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

    public BigDecimal averageMultiple(
            List<BigDecimal> values
    ) {
        if (values.isEmpty()) {
            return zeroFour();
        }

        return values.stream()
                .map(
                        this::multiple
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .divide(
                        BigDecimal.valueOf(
                                values.size()
                        ),
                        4,
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

    public BigDecimal multiple(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
                        4,
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

    private BigDecimal zeroFour() {
        return BigDecimal.ZERO
                .setScale(
                        4,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal hundred() {
        return new BigDecimal(
                "100.00"
        );
    }
}
