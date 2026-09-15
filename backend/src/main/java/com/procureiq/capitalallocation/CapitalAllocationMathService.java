package com.procureiq.capitalallocation;

import com.procureiq.strategicvalue.StrategicValueHealth;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class CapitalAllocationMathService {

    public CapitalAllocationPriorityResult priority(
            BigDecimal roiPct,
            BigDecimal paybackMonths,
            BigDecimal persistencePct,
            StrategicValueHealth valueHealth,
            BigDecimal netValueAmount
    ) {
        BigDecimal roiScore =
                decimal(
                        roiPct
                )
                        .divide(
                                new BigDecimal(
                                        "2.00"
                                ),
                                2,
                                RoundingMode.HALF_UP
                        )
                        .add(
                                new BigDecimal(
                                        "50.00"
                                )
                        );

        roiScore =
                bounded(
                        roiScore
                );

        BigDecimal persistenceScore =
                bounded(
                        persistencePct
                );

        BigDecimal paybackScore;

        if (
                paybackMonths == null
                ||
                decimal(
                        paybackMonths
                )
                        .compareTo(
                                BigDecimal.ZERO
                        )
                <= 0
        ) {
            paybackScore =
                    BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            );
        } else {
            paybackScore =
                    new BigDecimal(
                            "100.00"
                    )
                            .subtract(
                                    decimal(
                                            paybackMonths
                                    )
                                            .multiply(
                                                    new BigDecimal(
                                                            "100.00"
                                                    )
                                            )
                                            .divide(
                                                    new BigDecimal(
                                                            "60.00"
                                                    ),
                                                    2,
                                                    RoundingMode.HALF_UP
                                            )
                            );

            paybackScore =
                    bounded(
                            paybackScore
                    );
        }

        BigDecimal healthScore =
                healthScore(
                        valueHealth
                );

        BigDecimal priority =
                roiScore
                        .multiply(
                                new BigDecimal(
                                        "0.40"
                                )
                        )
                        .add(
                                persistenceScore
                                        .multiply(
                                                new BigDecimal(
                                                        "0.25"
                                                )
                                        )
                        )
                        .add(
                                paybackScore
                                        .multiply(
                                                new BigDecimal(
                                                        "0.20"
                                                )
                                        )
                        )
                        .add(
                                healthScore
                                        .multiply(
                                                new BigDecimal(
                                                        "0.15"
                                                )
                                        )
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        CapitalAllocationDecision recommendation =
                recommendation(
                        priority,
                        valueHealth,
                        netValueAmount,
                        roiPct
                );

        return new CapitalAllocationPriorityResult(
                roiScore,
                persistenceScore,
                paybackScore,
                healthScore,
                priority,
                recommendation
        );
    }

    public CapitalAllocationDecision recommendation(
            BigDecimal priorityScore,
            StrategicValueHealth health,
            BigDecimal netValueAmount,
            BigDecimal roiPct
    ) {
        if (
                health
                        == StrategicValueHealth.AT_RISK
                ||
                decimal(
                        netValueAmount
                )
                        .compareTo(
                                BigDecimal.ZERO
                        )
                < 0
                ||
                decimal(
                        roiPct
                )
                        .compareTo(
                                BigDecimal.ZERO
                        )
                < 0
        ) {
            return CapitalAllocationDecision.REJECT;
        }

        BigDecimal score =
                bounded(
                        priorityScore
                );

        if (
                score.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            return CapitalAllocationDecision.FUND;
        }

        if (
                score.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return CapitalAllocationDecision.DEFER;
        }

        return CapitalAllocationDecision.REJECT;
    }

    public CapitalAllocationPortfolioResult portfolio(
            BigDecimal budgetAmount,
            List<CapitalAllocationPortfolioItem> items
    ) {
        BigDecimal budget =
                money(
                        budgetAmount
                );

        BigDecimal funded =
                items.stream()
                        .filter(
                                item ->
                                        item.decision()
                                                == CapitalAllocationDecision.FUND
                        )
                        .map(
                                CapitalAllocationPortfolioItem::
                                        requestedCapitalAmount
                        )
                        .map(
                                this::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal remaining =
                budget
                        .subtract(
                                funded
                        )
                        .max(
                                BigDecimal.ZERO
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal utilization =
                budget.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? BigDecimal.ZERO
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                )
                        : funded
                                .multiply(
                                        new BigDecimal(
                                                "100.00"
                                        )
                                )
                                .divide(
                                        budget,
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

        BigDecimal fundedNetValue =
                items.stream()
                        .filter(
                                item ->
                                        item.decision()
                                                == CapitalAllocationDecision.FUND
                        )
                        .map(
                                CapitalAllocationPortfolioItem::
                                        netValueAmount
                        )
                        .map(
                                this::money
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal opportunityCost =
                items.stream()
                        .filter(
                                item ->
                                        item.decision()
                                                == CapitalAllocationDecision.DEFER
                        )
                        .map(
                                CapitalAllocationPortfolioItem::
                                        netValueAmount
                        )
                        .map(
                                this::money
                        )
                        .filter(
                                value ->
                                        value.compareTo(
                                                BigDecimal.ZERO
                                        )
                                        > 0
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        return new CapitalAllocationPortfolioResult(
                funded,
                remaining,
                utilization,
                fundedNetValue,
                opportunityCost
        );
    }

    public BigDecimal averagePriority(
            List<BigDecimal> scores
    ) {
        if (scores.isEmpty()) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return scores.stream()
                .map(
                        this::bounded
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .divide(
                        BigDecimal.valueOf(
                                scores.size()
                        ),
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal healthScore(
            StrategicValueHealth health
    ) {
        return switch (
                health
        ) {
            case STRONG ->
                    new BigDecimal(
                            "100.00"
                    );

            case HEALTHY ->
                    new BigDecimal(
                            "80.00"
                    );

            case WATCH ->
                    new BigDecimal(
                            "50.00"
                    );

            case AT_RISK ->
                    new BigDecimal(
                            "10.00"
                    );

            case UNASSESSED ->
                    BigDecimal.ZERO
                            .setScale(
                                    2,
                                    RoundingMode.HALF_UP
                            );
        };
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

    public BigDecimal bounded(
            BigDecimal value
    ) {
        return decimal(
                value
        )
                .max(
                        BigDecimal.ZERO
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                )
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                );
    }

    public record CapitalAllocationPortfolioItem(
            CapitalAllocationDecision decision,
            BigDecimal requestedCapitalAmount,
            BigDecimal netValueAmount
    ) {
    }
}
