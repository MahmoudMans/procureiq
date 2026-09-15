package com.procureiq.investmentintervention;

import com.procureiq.investmentperformance.InvestmentPerformanceHealth;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class InvestmentInterventionMathService {

    public InvestmentInterventionRecommendationResult recommend(
            InvestmentPerformanceHealth health,
            BigDecimal roiVariancePct,
            BigDecimal capitalEfficiencyMultiple,
            BigDecimal remainingCommitmentAmount
    ) {
        BigDecimal remaining =
                money(
                        remainingCommitmentAmount
                );

        if (
                remaining.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return new InvestmentInterventionRecommendationResult(
                    InvestmentInterventionAction.CONTINUE,
                    zero()
            );
        }

        BigDecimal roiVariance =
                decimal(
                        roiVariancePct
                );

        BigDecimal efficiency =
                multiple(
                        capitalEfficiencyMultiple
                );

        if (
                health
                        == InvestmentPerformanceHealth.UNDERPERFORMING
        ) {
            if (
                    roiVariance.compareTo(
                            new BigDecimal(
                                    "-25.00"
                            )
                    ) <= 0
                    ||
                    efficiency.compareTo(
                            new BigDecimal(
                                    "1.0000"
                            )
                    ) < 0
            ) {
                return new InvestmentInterventionRecommendationResult(
                        InvestmentInterventionAction.REALLOCATE_UNRELEASED,
                        remaining
                );
            }

            return new InvestmentInterventionRecommendationResult(
                    InvestmentInterventionAction.HOLD_FUTURE_RELEASES,
                    remaining
            );
        }

        if (
                health
                        == InvestmentPerformanceHealth.WATCH
        ) {
            if (
                    roiVariance.compareTo(
                            new BigDecimal(
                                    "-15.00"
                            )
                    ) <= 0
                    ||
                    efficiency.compareTo(
                            new BigDecimal(
                                    "1.0000"
                            )
                    ) < 0
            ) {
                return new InvestmentInterventionRecommendationResult(
                        InvestmentInterventionAction.REDUCE_UNRELEASED,
                        remaining
                                .multiply(
                                        new BigDecimal(
                                                "0.50"
                                        )
                                )
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                )
                );
            }

            return new InvestmentInterventionRecommendationResult(
                    InvestmentInterventionAction.HOLD_FUTURE_RELEASES,
                    remaining
            );
        }

        return new InvestmentInterventionRecommendationResult(
                InvestmentInterventionAction.CONTINUE,
                zero()
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
}
