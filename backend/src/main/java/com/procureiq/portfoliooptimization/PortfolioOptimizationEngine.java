package com.procureiq.portfoliooptimization;

import com.procureiq.categorymanagement.CategoryInitiativePriority;
import com.procureiq.categorymanagement.CategoryMatrixPosition;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Component
public class PortfolioOptimizationEngine {

    public PortfolioOptimizationResult optimize(
            List<PortfolioOptimizationCandidate> candidates,
            PortfolioOptimizationConstraints constraints
    ) {
        List<ScoredCandidate> scored =
                candidates.stream()
                        .map(
                                this::score
                        )
                        .collect(
                                java.util.stream.Collectors
                                        .toCollection(
                                                ArrayList::new
                                        )
                        );

        scored.sort(
                (
                        left,
                        right
                ) -> {
                    int utility =
                            right.utilityScore()
                                    .compareTo(
                                            left.utilityScore()
                                    );

                    if (utility != 0) {
                        return utility;
                    }

                    int savings =
                            right.targetSavings()
                                    .compareTo(
                                            left.targetSavings()
                                    );

                    if (savings != 0) {
                        return savings;
                    }

                    return left
                            .initiativeNumber()
                            .compareToIgnoreCase(
                                    right.initiativeNumber()
                            );
                }
        );

        List<PortfolioOptimizationSelection> selections =
                new ArrayList<>();

        BigDecimal selectedBudget =
                BigDecimal.ZERO;

        BigDecimal selectedSavings =
                BigDecimal.ZERO;

        BigDecimal selectedRiskSum =
                BigDecimal.ZERO;

        int selectedCount =
                0;

        int rank =
                0;

        for (
                ScoredCandidate candidate
                : scored
        ) {
            String exclusionReason =
                    null;

            if (
                    candidate.matrixPosition()
                            == CategoryMatrixPosition.CRITICAL_PRIORITY
                    &&
                    !constraints
                            .allowCriticalPriority()
            ) {
                exclusionReason =
                        "Critical-priority category initiatives are disabled by this scenario.";
            } else if (
                    selectedCount
                            >= constraints
                                    .maxInitiatives()
            ) {
                exclusionReason =
                        "Maximum initiative count has been reached.";
            } else if (
                    selectedBudget
                            .add(
                                    candidate.estimatedValue()
                            )
                            .compareTo(
                                    constraints
                                            .budgetLimit()
                            )
                            > 0
            ) {
                exclusionReason =
                        "Adding this initiative would exceed the scenario budget/capacity limit.";
            } else {
                BigDecimal tentativeRisk =
                        selectedRiskSum
                                .add(
                                        candidate.supplyRiskScore()
                                );

                BigDecimal tentativeAverage =
                        tentativeRisk
                                .divide(
                                        BigDecimal.valueOf(
                                                selectedCount
                                                        + 1L
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                );

                if (
                        tentativeAverage
                                .compareTo(
                                        constraints
                                                .maxAverageRiskScore()
                                )
                                > 0
                ) {
                    exclusionReason =
                            "Adding this initiative would exceed the maximum average portfolio risk.";
                }
            }

            if (exclusionReason == null) {
                selectedCount += 1;
                rank += 1;

                selectedBudget =
                        selectedBudget
                                .add(
                                        candidate.estimatedValue()
                                );

                selectedSavings =
                        selectedSavings
                                .add(
                                        candidate.targetSavings()
                                );

                selectedRiskSum =
                        selectedRiskSum
                                .add(
                                        candidate.supplyRiskScore()
                                );

                selections.add(
                        new PortfolioOptimizationSelection(
                                candidate.initiativeId(),
                                PortfolioScenarioDecision.SELECTED,
                                rank,
                                candidate.savingsEfficiencyPct(),
                                candidate.priorityScore(),
                                candidate.matrixUrgencyScore(),
                                candidate.utilityScore(),
                                null
                        )
                );
            } else {
                selections.add(
                        new PortfolioOptimizationSelection(
                                candidate.initiativeId(),
                                PortfolioScenarioDecision.EXCLUDED,
                                null,
                                candidate.savingsEfficiencyPct(),
                                candidate.priorityScore(),
                                candidate.matrixUrgencyScore(),
                                candidate.utilityScore(),
                                exclusionReason
                        )
                );
            }
        }

        BigDecimal averageRisk =
                selectedCount == 0
                        ? BigDecimal.ZERO
                        : selectedRiskSum
                                .divide(
                                        BigDecimal.valueOf(
                                                selectedCount
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        return new PortfolioOptimizationResult(
                candidates.size(),
                selectedCount,
                money(
                        selectedBudget
                ),
                money(
                        selectedSavings
                ),
                decimal(
                        averageRisk
                ),
                selectedSavings
                                .compareTo(
                                        constraints
                                                .minTotalTargetSavings()
                                )
                        >= 0,
                List.copyOf(
                        selections
                )
        );
    }

    private ScoredCandidate score(
            PortfolioOptimizationCandidate candidate
    ) {
        BigDecimal efficiency =
                savingsEfficiency(
                        candidate
                );

        BigDecimal priority =
                priorityScore(
                        candidate.priority()
                );

        BigDecimal matrix =
                matrixUrgencyScore(
                        candidate.matrixPosition()
                );

        BigDecimal utility =
                efficiency
                        .multiply(
                                new BigDecimal(
                                        "0.40"
                                )
                        )
                        .add(
                                candidate
                                        .strategicValueScore()
                                        .multiply(
                                                new BigDecimal(
                                                        "0.25"
                                                )
                                        )
                        )
                        .add(
                                priority
                                        .multiply(
                                                new BigDecimal(
                                                        "0.20"
                                                )
                                        )
                        )
                        .add(
                                matrix
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

        return new ScoredCandidate(
                candidate.initiativeId(),
                candidate.initiativeNumber(),
                candidate.matrixPosition(),
                candidate.estimatedValue(),
                candidate.targetSavings(),
                candidate.supplyRiskScore(),
                efficiency,
                priority,
                matrix,
                utility
        );
    }

    private BigDecimal savingsEfficiency(
            PortfolioOptimizationCandidate candidate
    ) {
        if (
                candidate
                        .estimatedValue()
                        .compareTo(
                                BigDecimal.ZERO
                        )
                        <= 0
        ) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        /*
         * 10% savings / managed value = score 100.
         * 5% = score 50.
         * Values above 10% are capped at 100.
         */
        return candidate
                .targetSavings()
                .multiply(
                        new BigDecimal(
                                "1000.00"
                        )
                )
                .divide(
                        candidate
                                .estimatedValue(),
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
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal priorityScore(
            CategoryInitiativePriority priority
    ) {
        return switch (
                priority
        ) {
            case LOW ->
                    value(
                            25
                    );

            case MEDIUM ->
                    value(
                            50
                    );

            case HIGH ->
                    value(
                            75
                    );

            case CRITICAL ->
                    value(
                            100
                    );
        };
    }

    private BigDecimal matrixUrgencyScore(
            CategoryMatrixPosition matrixPosition
    ) {
        return switch (
                matrixPosition
        ) {
            case MANAGE ->
                    value(
                            50
                    );

            case VALUE_OPTIMIZATION ->
                    value(
                            90
                    );

            case RISK_MITIGATION ->
                    value(
                            85
                    );

            case CRITICAL_PRIORITY ->
                    value(
                            100
                    );
        };
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        return value
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal decimal(
            BigDecimal value
    ) {
        return value
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal value(
            int value
    ) {
        return BigDecimal
                .valueOf(
                        value
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private record ScoredCandidate(
            java.util.UUID initiativeId,
            String initiativeNumber,
            CategoryMatrixPosition matrixPosition,
            BigDecimal estimatedValue,
            BigDecimal targetSavings,
            BigDecimal supplyRiskScore,
            BigDecimal savingsEfficiencyPct,
            BigDecimal priorityScore,
            BigDecimal matrixUrgencyScore,
            BigDecimal utilityScore
    ) {
    }
}
