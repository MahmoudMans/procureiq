package com.procureiq.strategicvalue;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class StrategicValueMathService {

    public StrategicValueMetricResult metrics(
            BigDecimal investmentCostAmount,
            BigDecimal annualOperatingCostAmount,
            BigDecimal annualizedValueAmount,
            int valueHorizonMonths,
            BigDecimal persistencePct,
            BigDecimal targetRoiPct,
            BigDecimal targetPaybackMonths
    ) {
        BigDecimal investment =
                money(
                        investmentCostAmount
                );

        BigDecimal annualOperatingCost =
                money(
                        annualOperatingCostAmount
                );

        BigDecimal annualizedValue =
                money(
                        annualizedValueAmount
                );

        BigDecimal persistence =
                boundedPercent(
                        persistencePct
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

        BigDecimal baselineHorizonValue =
                annualizedValue
                        .multiply(
                                horizonYears
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal durableAnnualValue =
                annualizedValue
                        .multiply(
                                persistence
                        )
                        .divide(
                                new BigDecimal(
                                        "100.00"
                                ),
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal durableHorizonValue =
                durableAnnualValue
                        .multiply(
                                horizonYears
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal decayedValue =
                baselineHorizonValue
                        .subtract(
                                durableHorizonValue
                        )
                        .max(
                                BigDecimal.ZERO
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

        BigDecimal totalCost =
                investment
                        .add(
                                operatingCostHorizon
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal netValue =
                durableHorizonValue
                        .subtract(
                                totalCost
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal roi =
                totalCost.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zero()
                        : netValue
                                .multiply(
                                        new BigDecimal(
                                                "100.00"
                                        )
                                )
                                .divide(
                                        totalCost,
                                        2,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal annualNetCashBenefit =
                durableAnnualValue
                        .subtract(
                                annualOperatingCost
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal paybackMonths =
                annualNetCashBenefit.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? null
                        : investment
                                .multiply(
                                        new BigDecimal(
                                                "12.00"
                                        )
                                )
                                .divide(
                                        annualNetCashBenefit,
                                        2,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal valueAtRisk =
                decayedValue;

        StrategicValueHealth health =
                valueHealth(
                        roi,
                        paybackMonths,
                        targetRoiPct,
                        targetPaybackMonths
                );

        return new StrategicValueMetricResult(
                persistence,
                baselineHorizonValue,
                durableAnnualValue,
                durableHorizonValue,
                decayedValue,
                operatingCostHorizon,
                totalCost,
                netValue,
                roi,
                paybackMonths,
                valueAtRisk,
                health
        );
    }

    public StrategicValueHealth valueHealth(
            BigDecimal roiPct,
            BigDecimal paybackMonths,
            BigDecimal targetRoiPct,
            BigDecimal targetPaybackMonths
    ) {
        BigDecimal roi =
                decimal(
                        roiPct
                );

        BigDecimal targetRoi =
                decimal(
                        targetRoiPct
                );

        BigDecimal targetPayback =
                decimal(
                        targetPaybackMonths
                );

        if (
                roi.compareTo(
                        targetRoi
                ) >= 0
                &&
                paybackMonths != null
                &&
                decimal(
                        paybackMonths
                )
                        .compareTo(
                                targetPayback
                        )
                <= 0
        ) {
            return StrategicValueHealth.STRONG;
        }

        if (
                roi.compareTo(
                        BigDecimal.ZERO
                ) >= 0
                &&
                paybackMonths != null
                &&
                decimal(
                        paybackMonths
                )
                        .compareTo(
                                targetPayback
                                        .multiply(
                                                new BigDecimal(
                                                        "1.25"
                                                )
                                        )
                        )
                <= 0
        ) {
            return StrategicValueHealth.HEALTHY;
        }

        if (
                roi.compareTo(
                        BigDecimal.ZERO
                ) >= 0
        ) {
            return StrategicValueHealth.WATCH;
        }

        return StrategicValueHealth.AT_RISK;
    }

    public StrategicValueHealth portfolioHealth(
            BigDecimal portfolioRoiPct,
            List<StrategicValueHealth> caseHealth
    ) {
        if (caseHealth.isEmpty()) {
            return StrategicValueHealth.UNASSESSED;
        }

        boolean atRisk =
                caseHealth.stream()
                        .anyMatch(
                                health ->
                                        health
                                                == StrategicValueHealth.AT_RISK
                        );

        if (
                atRisk
                &&
                decimal(
                        portfolioRoiPct
                )
                        .compareTo(
                                BigDecimal.ZERO
                        )
                < 0
        ) {
            return StrategicValueHealth.AT_RISK;
        }

        boolean allStrong =
                caseHealth.stream()
                        .allMatch(
                                health ->
                                        health
                                                == StrategicValueHealth.STRONG
                        );

        if (allStrong) {
            return StrategicValueHealth.STRONG;
        }

        boolean healthyOnly =
                caseHealth.stream()
                        .allMatch(
                                health ->
                                        health
                                                == StrategicValueHealth.STRONG
                                        ||
                                        health
                                                == StrategicValueHealth.HEALTHY
                        );

        if (healthyOnly) {
            return StrategicValueHealth.HEALTHY;
        }

        return StrategicValueHealth.WATCH;
    }

    public BigDecimal portfolioRoi(
            BigDecimal totalNetValue,
            BigDecimal totalCost
    ) {
        BigDecimal cost =
                money(
                        totalCost
                );

        if (
                cost.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return zero();
        }

        return decimal(
                totalNetValue
        )
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        cost,
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal portfolioPaybackMonths(
            BigDecimal totalInvestment,
            BigDecimal totalDurableAnnualValue,
            BigDecimal totalAnnualOperatingCost
    ) {
        BigDecimal annualNet =
                money(
                        totalDurableAnnualValue
                )
                        .subtract(
                                money(
                                        totalAnnualOperatingCost
                                )
                        );

        if (
                annualNet.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return null;
        }

        return money(
                totalInvestment
        )
                .multiply(
                        new BigDecimal(
                                "12.00"
                        )
                )
                .divide(
                        annualNet,
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

    public BigDecimal boundedPercent(
            BigDecimal value
    ) {
        return decimal(
                value
        )
                .max(
                        zero()
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
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
