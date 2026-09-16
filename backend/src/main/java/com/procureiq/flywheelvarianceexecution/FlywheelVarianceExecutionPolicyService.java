package com.procureiq.flywheelvarianceexecution;

import com.procureiq.flywheelvariance.FlywheelVarianceDecision;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class FlywheelVarianceExecutionPolicyService {

    private static final BigDecimal MAX_MONEY =
            new BigDecimal(
                    "999999999999999999.99"
            );

    public FlywheelVarianceExecutionValidationResult validate(
            FlywheelVarianceDecision decision,
            BigDecimal sourceVarianceAmount,
            BigDecimal executedAmount,
            FlywheelVarianceExecutionOutcome outcome,
            String evidenceReference
    ) {
        if (decision == null) {
            throw new IllegalArgumentException(
                    "Source variance decision is required."
            );
        }

        if (outcome == null) {
            throw new IllegalArgumentException(
                    "Execution outcome is required."
            );
        }

        BigDecimal source =
                positiveMoney(
                        sourceVarianceAmount,
                        "Source variance"
                );

        BigDecimal executed =
                nonNegativeMoney(
                        executedAmount,
                        "Executed amount"
                );

        if (
                executed.compareTo(
                        source
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Executed amount cannot exceed source variance."
            );
        }

        BigDecimal openExposure;

        if (
                decision
                        == FlywheelVarianceDecision.INVESTIGATE
        ) {
            if (
                executed.signum()
                        != 0
            ) {
                throw new IllegalArgumentException(
                        "INVESTIGATE is non-financial and requires an executed amount of 0.00."
                );
            }

            if (
                outcome
                        == FlywheelVarianceExecutionOutcome.PARTIAL
            ) {
                throw new IllegalArgumentException(
                        "INVESTIGATE cannot use a PARTIAL execution outcome."
                );
            }

            openExposure =
                    outcome
                            == FlywheelVarianceExecutionOutcome.COMPLETED
                            ? BigDecimal.ZERO
                                    .setScale(
                                            2,
                                            RoundingMode.UNNECESSARY
                                    )
                            : source;

        } else {
            if (
                outcome
                        == FlywheelVarianceExecutionOutcome.COMPLETED
                &&
                executed.compareTo(
                        source
                ) != 0
            ) {
                throw new IllegalArgumentException(
                        "COMPLETED recovery/write-off evidence requires the full source variance amount."
                );
            }

            if (
                outcome
                        == FlywheelVarianceExecutionOutcome.PARTIAL
                &&
                (
                        executed.signum()
                                <= 0
                        ||
                        executed.compareTo(
                                source
                        ) >= 0
                )
            ) {
                throw new IllegalArgumentException(
                        "PARTIAL recovery/write-off evidence requires an amount above zero and below the source variance."
                );
            }

            if (
                outcome
                        == FlywheelVarianceExecutionOutcome.UNRESOLVED
                &&
                executed.signum()
                        != 0
            ) {
                throw new IllegalArgumentException(
                        "UNRESOLVED recovery/write-off evidence requires an executed amount of 0.00."
                );
            }

            if (
                executed.signum() > 0
                &&
                (
                        evidenceReference == null
                        ||
                        evidenceReference.trim().isEmpty()
                )
            ) {
                throw new IllegalArgumentException(
                        "Positive financial treatment execution requires an external evidence reference."
                );
            }

            openExposure =
                    source
                            .subtract(
                                    executed
                            )
                            .setScale(
                                    2,
                                    RoundingMode.UNNECESSARY
                            );
        }

        return new FlywheelVarianceExecutionValidationResult(
                source,
                executed,
                openExposure,
                outcome
        );
    }

    public FlywheelVarianceExecutionMetricResult metrics(
            BigDecimal sourceVarianceAmount,
            List<FlywheelVarianceExecutionMetricInput> items
    ) {
        BigDecimal source =
                positiveMoney(
                        sourceVarianceAmount,
                        "Source variance"
                );

        BigDecimal captured =
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.UNNECESSARY
                        );

        BigDecimal recovered =
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.UNNECESSARY
                        );

        BigDecimal writtenOff =
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.UNNECESSARY
                        );

        BigDecimal completedInvestigation =
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.UNNECESSARY
                        );

        BigDecimal open =
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.UNNECESSARY
                        );

        for (
                FlywheelVarianceExecutionMetricInput item
                : items
        ) {
            FlywheelVarianceExecutionValidationResult validated =
                    validate(
                            item.decision(),
                            item.sourceVarianceAmount(),
                            item.executedAmount(),
                            item.outcome(),
                            "METRIC-INTERNAL"
                    );

            captured =
                    captured.add(
                            validated.sourceVarianceAmount()
                    );

            if (
                item.decision()
                        == FlywheelVarianceDecision.RECOVER
            ) {
                recovered =
                        recovered.add(
                                validated.executedAmount()
                        );

            } else if (
                item.decision()
                        == FlywheelVarianceDecision.WRITE_OFF
            ) {
                writtenOff =
                        writtenOff.add(
                                validated.executedAmount()
                        );

            } else if (
                item.outcome()
                        == FlywheelVarianceExecutionOutcome.COMPLETED
            ) {
                completedInvestigation =
                        completedInvestigation.add(
                                validated.sourceVarianceAmount()
                        );
            }

            open =
                    open.add(
                            validated.openExposureAmount()
                    );
        }

        if (
                captured.compareTo(
                        source
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Captured execution authority cannot exceed source variance."
            );
        }

        BigDecimal financial =
                recovered
                        .add(
                                writtenOff
                        )
                        .setScale(
                                2,
                                RoundingMode.UNNECESSARY
                        );

        BigDecimal resolvedEquivalent =
                captured
                        .subtract(
                                open
                        )
                        .setScale(
                                2,
                                RoundingMode.UNNECESSARY
                        );

        BigDecimal completionPct =
                resolvedEquivalent
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

        return new FlywheelVarianceExecutionMetricResult(
                captured,
                financial,
                recovered,
                writtenOff,
                completedInvestigation,
                open,
                completionPct
        );
    }

    public BigDecimal money(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        ).setScale(
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
