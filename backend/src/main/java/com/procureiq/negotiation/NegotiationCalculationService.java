package com.procureiq.negotiation;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class NegotiationCalculationService {

    private static final BigDecimal HUNDRED =
            new BigDecimal(
                    "100.00"
            );

    public BigDecimal savings(
            BigDecimal baseline,
            BigDecimal offer
    ) {
        requireNonNegative(
                baseline,
                "Baseline"
        );

        requireNonNegative(
                offer,
                "Offer"
        );

        return baseline
                .subtract(
                        offer
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal savingsPercentage(
            BigDecimal baseline,
            BigDecimal offer
    ) {
        requireNonNegative(
                baseline,
                "Baseline"
        );

        requireNonNegative(
                offer,
                "Offer"
        );

        if (
                baseline.compareTo(
                        BigDecimal.ZERO
                ) == 0
        ) {
            return BigDecimal.ZERO
                    .setScale(2);
        }

        return baseline
                .subtract(
                        offer
                )
                .multiply(
                        HUNDRED
                )
                .divide(
                        baseline,
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BigDecimal scenarioScore(
            BigDecimal baseline,
            BigDecimal offer,
            int paymentTermsDays,
            int leadTimeDays,
            int warrantyMonths
    ) {
        if (
                paymentTermsDays < 0
                ||
                leadTimeDays < 0
                ||
                warrantyMonths < 0
        ) {
            throw new IllegalArgumentException(
                    "Negotiation terms cannot be negative."
            );
        }

        BigDecimal savingsPct =
                savingsPercentage(
                        baseline,
                        offer
                )
                        .max(
                                BigDecimal.ZERO
                        );

        BigDecimal priceComponent =
                savingsPct
                        .divide(
                                new BigDecimal(
                                        "20.00"
                                ),
                                8,
                                RoundingMode.HALF_UP
                        )
                        .multiply(
                                new BigDecimal(
                                        "60.00"
                                )
                        )
                        .min(
                                new BigDecimal(
                                        "60.00"
                                )
                        );

        BigDecimal paymentComponent =
                BigDecimal
                        .valueOf(
                                paymentTermsDays
                        )
                        .divide(
                                new BigDecimal(
                                        "90.00"
                                ),
                                8,
                                RoundingMode.HALF_UP
                        )
                        .multiply(
                                new BigDecimal(
                                        "15.00"
                                )
                        )
                        .min(
                                new BigDecimal(
                                        "15.00"
                                )
                        );

        BigDecimal leadComponent =
                new BigDecimal(
                        "15.00"
                )
                        .subtract(
                                BigDecimal
                                        .valueOf(
                                                Math.min(
                                                        leadTimeDays,
                                                        90
                                                )
                                        )
                                        .divide(
                                                new BigDecimal(
                                                        "90.00"
                                                ),
                                                8,
                                                RoundingMode.HALF_UP
                                        )
                                        .multiply(
                                                new BigDecimal(
                                                        "15.00"
                                                )
                                        )
                        )
                        .max(
                                BigDecimal.ZERO
                        );

        BigDecimal warrantyComponent =
                BigDecimal
                        .valueOf(
                                warrantyMonths
                        )
                        .divide(
                                new BigDecimal(
                                        "36.00"
                                ),
                                8,
                                RoundingMode.HALF_UP
                        )
                        .multiply(
                                new BigDecimal(
                                        "10.00"
                                )
                        )
                        .min(
                                new BigDecimal(
                                        "10.00"
                                )
                        );

        return priceComponent
                .add(
                        paymentComponent
                )
                .add(
                        leadComponent
                )
                .add(
                        warrantyComponent
                )
                .min(
                        HUNDRED
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private void requireNonNegative(
            BigDecimal value,
            String label
    ) {
        if (
                value == null
                ||
                value.compareTo(
                        BigDecimal.ZERO
                ) < 0
        ) {
            throw new IllegalArgumentException(
                    label
                            + " value must be zero or greater."
            );
        }
    }
}
