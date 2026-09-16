package com.procureiq.flywheelvariance;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class FlywheelVariancePolicyService {

    private static final BigDecimal MAX_MONEY =
            new BigDecimal(
                    "999999999999999999.99"
            );

    public FlywheelVarianceMetricResult metrics(
            BigDecimal sourceVarianceAmount,
            List<FlywheelVarianceMetricInput> items
    ) {
        BigDecimal source =
                positiveMoney(
                        sourceVarianceAmount,
                        "Source variance"
                );

        BigDecimal recover =
                total(
                        items,
                        FlywheelVarianceDecision.RECOVER
                );

        BigDecimal writeOff =
                total(
                        items,
                        FlywheelVarianceDecision.WRITE_OFF
                );

        BigDecimal investigate =
                total(
                        items,
                        FlywheelVarianceDecision.INVESTIGATE
                );

        BigDecimal governed =
                recover
                        .add(
                                writeOff
                        )
                        .add(
                                investigate
                        )
                        .setScale(
                                2,
                                RoundingMode.UNNECESSARY
                        );

        if (
                governed.compareTo(
                        source
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Governed variance cannot exceed settlement variance."
            );
        }

        BigDecimal coverage =
                governed
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

        return new FlywheelVarianceMetricResult(
                governed,
                recover,
                writeOff,
                investigate,
                coverage
        );
    }

    public BigDecimal money(
            BigDecimal value
    ) {
        if (value == null) {
            return BigDecimal.ZERO
                    .setScale(
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

    private BigDecimal total(
            List<FlywheelVarianceMetricInput> items,
            FlywheelVarianceDecision decision
    ) {
        return items
                .stream()
                .filter(
                        item ->
                                item.decision()
                                        == decision
                )
                .map(
                        item ->
                                positiveMoney(
                                        item.amount(),
                                        "Variance treatment amount"
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
    }

    private BigDecimal positiveMoney(
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
                normalized.signum() <= 0
                ||
                normalized.compareTo(
                        MAX_MONEY
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    label
                            + " must be within the supported positive monetary range."
            );
        }

        return normalized;
    }
}
