package com.procureiq.flywheelsettlement;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class FlywheelSettlementPolicyService {

    private static final BigDecimal MAX_MONEY =
            new BigDecimal("999999999999999999.99");

    public FlywheelSettlementClassificationResult classify(
            BigDecimal sourceReleasedAmount,
            BigDecimal settledAmount,
            String evidenceReference
    ) {
        BigDecimal source =
                positiveMoney(
                        sourceReleasedAmount,
                        "Source release amount"
                );

        BigDecimal settled =
                nonNegativeMoney(
                        settledAmount,
                        "Settled amount"
                );

        if (
                settled.compareTo(
                        source
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Settled amount cannot exceed the recorded release amount."
            );
        }

        if (
                settled.signum() > 0
                &&
                (
                        evidenceReference == null
                        ||
                        evidenceReference.trim().isEmpty()
                )
        ) {
            throw new IllegalArgumentException(
                    "Positive settlement evidence requires an external evidence reference."
            );
        }

        FlywheelSettlementItemStatus status;

        if (
                settled.compareTo(
                        source
                ) == 0
        ) {
            status =
                    FlywheelSettlementItemStatus.SETTLED;

        } else if (
                settled.signum() == 0
        ) {
            status =
                    FlywheelSettlementItemStatus.UNRESOLVED;

        } else {
            status =
                    FlywheelSettlementItemStatus.PARTIAL;
        }

        return new FlywheelSettlementClassificationResult(
                source,
                settled,
                source
                        .subtract(
                                settled
                        )
                        .setScale(
                                2,
                                RoundingMode.UNNECESSARY
                        ),
                status
        );
    }

    public FlywheelSettlementMetricResult metrics(
            BigDecimal sourceReleasedAmount,
            List<BigDecimal> settledAmounts
    ) {
        BigDecimal source =
                positiveMoney(
                        sourceReleasedAmount,
                        "Source release amount"
                );

        BigDecimal settled =
                settledAmounts
                        .stream()
                        .map(
                                value ->
                                        nonNegativeMoney(
                                                value,
                                                "Settled amount"
                                        )
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.UNNECESSARY
                        );

        if (
                settled.compareTo(
                        source
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Aggregate settlement cannot exceed the recorded release amount."
            );
        }

        BigDecimal variance =
                source
                        .subtract(
                                settled
                        )
                        .setScale(
                                2,
                                RoundingMode.UNNECESSARY
                        );

        BigDecimal settlementPct =
                settled
                        .multiply(
                                new BigDecimal(
                                        "100.00"
                                )
                        )
                        .divide(
                                source,
                                2,
                                RoundingMode.HALF_UP
                        );

        return new FlywheelSettlementMetricResult(
                settled,
                variance,
                settlementPct
        );
    }

    public BigDecimal money(
            BigDecimal value
    ) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(
                    2,
                    RoundingMode.UNNECESSARY
            );
        }

        return value.setScale(
                2,
                RoundingMode.HALF_UP
        );
    }

    public String requiredText(
            String value,
            int maxLength,
            String label
    ) {
        if (
                value == null
                ||
                value.trim().isEmpty()
        ) {
            throw new IllegalArgumentException(
                    label + " is required."
            );
        }

        String normalized =
                value.trim();

        if (
                normalized.length()
                        > maxLength
        ) {
            throw new IllegalArgumentException(
                    label
                            + " cannot exceed "
                            + maxLength
                            + " characters."
            );
        }

        return normalized;
    }

    public String optionalReference(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String normalized =
                value.trim();

        if (normalized.isEmpty()) {
            return null;
        }

        if (
                normalized.length()
                        > 300
        ) {
            throw new IllegalArgumentException(
                    "Evidence reference cannot exceed 300 characters."
            );
        }

        return normalized;
    }

    private BigDecimal positiveMoney(
            BigDecimal value,
            String label
    ) {
        BigDecimal normalized =
                exactMoney(
                        value,
                        label
                );

        if (
                normalized.signum()
                        <= 0
        ) {
            throw new IllegalArgumentException(
                    label
                            + " must be positive."
            );
        }

        return normalized;
    }

    private BigDecimal nonNegativeMoney(
            BigDecimal value,
            String label
    ) {
        BigDecimal normalized =
                exactMoney(
                        value,
                        label
                );

        if (
                normalized.signum()
                        < 0
        ) {
            throw new IllegalArgumentException(
                    label
                            + " cannot be negative."
            );
        }

        return normalized;
    }

    private BigDecimal exactMoney(
            BigDecimal value,
            String label
    ) {
        if (value == null) {
            throw new IllegalArgumentException(
                    label + " is required."
            );
        }

        final BigDecimal normalized;

        try {
            normalized =
                    value.setScale(
                            2,
                            RoundingMode.UNNECESSARY
                    );

        } catch (
                ArithmeticException exception
        ) {
            throw new IllegalArgumentException(
                    label
                            + " must have at most two decimal places.",
                    exception
            );
        }

        if (
                normalized.abs()
                        .compareTo(
                                MAX_MONEY
                        ) > 0
        ) {
            throw new IllegalArgumentException(
                    label
                            + " exceeds the supported monetary range."
            );
        }

        return normalized;
    }
}
