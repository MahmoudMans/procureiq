package com.procureiq.reinvestmentpersistence;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class ReinvestmentPersistenceMathService {

    public ReinvestmentPersistenceMetricResult metrics(
            BigDecimal redeployedCapitalAmount,
            BigDecimal baselineAnnualizedValueAmount,
            BigDecimal baselineHorizonValueAmount,
            BigDecimal baselineNetValueAmount,
            BigDecimal baselineTotalCostAmount,
            BigDecimal baselineRoiPct,
            int measurementHorizonMonths,
            BigDecimal currentAnnualizedValueAmount,
            BigDecimal minimumValuePersistencePct,
            BigDecimal minimumEfficiencyRetentionPct,
            boolean assessed
    ) {
        BigDecimal baselineAnnual =
                money(
                        baselineAnnualizedValueAmount
                );

        BigDecimal baselineHorizon =
                money(
                        baselineHorizonValueAmount
                );

        BigDecimal baselineNet =
                money(
                        baselineNetValueAmount
                );

        BigDecimal totalCost =
                money(
                        baselineTotalCostAmount
                );

        BigDecimal capital =
                money(
                        redeployedCapitalAmount
                );

        BigDecimal baselineRoi =
                decimal(
                        baselineRoiPct
                );

        if (!assessed) {
            return new ReinvestmentPersistenceMetricResult(
                    baselineAnnual,
                    zeroMoney(),
                    baselineHorizon,
                    zeroMoney(),
                    baselineNet,
                    zeroMoney(),
                    baselineRoi,
                    zeroPercent(),
                    zeroPercent(),
                    zeroPercent(),
                    zeroMoney(),
                    zeroMoney(),
                    baselineEfficiency(
                            baselineHorizon,
                            capital
                    ),
                    zeroMultiple(),
                    zeroMultiple(),
                    zeroPercent(),
                    ReinvestmentPersistenceHealth.UNASSESSED
            );
        }

        BigDecimal currentAnnual =
                money(
                        currentAnnualizedValueAmount
                );

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

        BigDecimal currentHorizon =
                currentAnnual
                        .multiply(
                                horizonYears
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal currentNet =
                currentHorizon
                        .subtract(
                                totalCost
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal currentRoi =
                totalCost.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zeroPercent()
                        : currentNet
                                .multiply(
                                        hundred()
                                )
                                .divide(
                                        totalCost,
                                        2,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal roiVariance =
                currentRoi
                        .subtract(
                                baselineRoi
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal persistence =
                ratioPct(
                        currentHorizon,
                        baselineHorizon
                );

        BigDecimal compounding =
                currentHorizon
                        .subtract(
                                baselineHorizon
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal decay =
                baselineHorizon
                        .subtract(
                                currentHorizon
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal baselineEfficiency =
                baselineEfficiency(
                        baselineHorizon,
                        capital
                );

        BigDecimal currentEfficiency =
                capital.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zeroMultiple()
                        : currentHorizon
                                .divide(
                                        capital,
                                        4,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal efficiencyDelta =
                currentEfficiency
                        .subtract(
                                baselineEfficiency
                        )
                        .setScale(
                                4,
                                RoundingMode.HALF_UP
                        );

        BigDecimal efficiencyRetention =
                ratioPct(
                        currentEfficiency,
                        baselineEfficiency
                );

        ReinvestmentPersistenceHealth health =
                health(
                        persistence,
                        efficiencyRetention,
                        currentRoi,
                        baselineRoi,
                        minimumValuePersistencePct,
                        minimumEfficiencyRetentionPct
                );

        return new ReinvestmentPersistenceMetricResult(
                baselineAnnual,
                currentAnnual,

                baselineHorizon,
                currentHorizon,

                baselineNet,
                currentNet,

                baselineRoi,
                currentRoi,
                roiVariance,

                persistence,
                compounding,
                decay,

                baselineEfficiency,
                currentEfficiency,
                efficiencyDelta,
                efficiencyRetention,

                health
        );
    }

    public ReinvestmentPersistenceHealth health(
            BigDecimal valuePersistencePct,
            BigDecimal efficiencyRetentionPct,
            BigDecimal currentProjectedRoiPct,
            BigDecimal baselineRoiPct,
            BigDecimal minimumValuePersistencePct,
            BigDecimal minimumEfficiencyRetentionPct
    ) {
        BigDecimal persistence =
                decimal(
                        valuePersistencePct
                );

        BigDecimal efficiency =
                decimal(
                        efficiencyRetentionPct
                );

        BigDecimal currentRoi =
                decimal(
                        currentProjectedRoiPct
                );

        BigDecimal baselineRoi =
                decimal(
                        baselineRoiPct
                );

        BigDecimal minimumPersistence =
                decimal(
                        minimumValuePersistencePct
                );

        BigDecimal minimumEfficiency =
                decimal(
                        minimumEfficiencyRetentionPct
                );

        if (
                persistence.compareTo(
                        new BigDecimal(
                                "110.00"
                        )
                ) >= 0
                &&
                efficiency.compareTo(
                        new BigDecimal(
                                "110.00"
                        )
                ) >= 0
                &&
                currentRoi.compareTo(
                        baselineRoi
                ) >= 0
        ) {
            return ReinvestmentPersistenceHealth.COMPOUNDING;
        }

        if (
                persistence.compareTo(
                        minimumPersistence
                ) >= 0
                &&
                efficiency.compareTo(
                        minimumEfficiency
                ) >= 0
        ) {
            return ReinvestmentPersistenceHealth.SUSTAINED;
        }

        BigDecimal persistenceWatch =
                minimumPersistence
                        .multiply(
                                new BigDecimal(
                                        "0.75"
                                )
                        );

        BigDecimal efficiencyWatch =
                minimumEfficiency
                        .multiply(
                                new BigDecimal(
                                        "0.75"
                                )
                        );

        if (
                persistence.compareTo(
                        persistenceWatch
                ) >= 0
                &&
                efficiency.compareTo(
                        efficiencyWatch
                ) >= 0
        ) {
            return ReinvestmentPersistenceHealth.WATCH;
        }

        if (
                persistence.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return ReinvestmentPersistenceHealth.DECAYING;
        }

        return ReinvestmentPersistenceHealth.REGRESSED;
    }

    public BigDecimal average(
            List<BigDecimal> values
    ) {
        if (values.isEmpty()) {
            return zeroPercent();
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

    private BigDecimal ratioPct(
            BigDecimal numerator,
            BigDecimal denominator
    ) {
        if (
                denominator == null
                ||
                denominator.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return numerator != null
                    &&
                    numerator.compareTo(
                            BigDecimal.ZERO
                    ) > 0
                    ? new BigDecimal(
                            "999.99"
                    )
                    : zeroPercent();
        }

        return numerator
                .multiply(
                        hundred()
                )
                .divide(
                        denominator,
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        zeroPercent()
                )
                .min(
                        new BigDecimal(
                                "999.99"
                        )
                );
    }

    private BigDecimal baselineEfficiency(
            BigDecimal baselineHorizonValue,
            BigDecimal capital
    ) {
        if (
                capital.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return zeroMultiple();
        }

        return baselineHorizonValue
                .divide(
                        capital,
                        4,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal zeroMoney() {
        return BigDecimal.ZERO
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal zeroPercent() {
        return BigDecimal.ZERO
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal zeroMultiple() {
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
