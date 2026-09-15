package com.procureiq.fundingexecution;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class FundingExecutionMathService {

    public FundingMetricResult metrics(
            BigDecimal authorizedCapitalAmount,
            BigDecimal committedCapitalAmount,
            BigDecimal plannedReleaseAmount,
            BigDecimal releasedAmount
    ) {
        BigDecimal authorized =
                money(
                        authorizedCapitalAmount
                );

        BigDecimal committed =
                money(
                        committedCapitalAmount
                );

        BigDecimal planned =
                money(
                        plannedReleaseAmount
                );

        BigDecimal released =
                money(
                        releasedAmount
                );

        BigDecimal remainingAuthorization =
                authorized
                        .subtract(
                                committed
                        )
                        .max(
                                zero()
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal remainingCommitment =
                committed
                        .subtract(
                                released
                        )
                        .max(
                                zero()
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal plannedCoverage =
                committed.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zero()
                        : planned
                                .multiply(
                                        hundred()
                                )
                                .divide(
                                        committed,
                                        2,
                                        RoundingMode.HALF_UP
                                )
                                .max(
                                        zero()
                                )
                                .min(
                                        hundred()
                                );

        BigDecimal releasePct =
                committed.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? zero()
                        : released
                                .multiply(
                                        hundred()
                                )
                                .divide(
                                        committed,
                                        2,
                                        RoundingMode.HALF_UP
                                )
                                .max(
                                        zero()
                                )
                                .min(
                                        hundred()
                                );

        return new FundingMetricResult(
                remainingAuthorization,
                remainingCommitment,
                plannedCoverage,
                releasePct
        );
    }

    public boolean exactFundingPlan(
            BigDecimal committedCapitalAmount,
            BigDecimal plannedReleaseAmount
    ) {
        return money(
                committedCapitalAmount
        )
                .compareTo(
                        money(
                                plannedReleaseAmount
                        )
                )
                == 0;
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
