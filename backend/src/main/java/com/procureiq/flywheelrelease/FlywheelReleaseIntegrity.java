package com.procureiq.flywheelrelease;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

public final class FlywheelReleaseIntegrity {

    private static final BigDecimal MAX_AMOUNT =
            new BigDecimal("999999999999999999.99");

    private FlywheelReleaseIntegrity() {
    }

    public static BigDecimal positiveMoney(BigDecimal value) {
        if (value == null) {
            throw new IllegalArgumentException(
                    "Release amount is required."
            );
        }

        final BigDecimal normalized;

        try {
            normalized = value.setScale(
                    2,
                    RoundingMode.UNNECESSARY
            );
        } catch (ArithmeticException exception) {
            throw new IllegalArgumentException(
                    "Release amount must have at most two decimal places.",
                    exception
            );
        }

        if (
                normalized.signum() <= 0
                || normalized.compareTo(MAX_AMOUNT) > 0
        ) {
            throw new IllegalArgumentException(
                    "Release amount is outside the supported positive range."
            );
        }

        return normalized;
    }

    public static String text(
            String value,
            int limit,
            String label
    ) {
        if (
                value == null
                || value.trim().isEmpty()
                || value.trim().length() > limit
        ) {
            throw new IllegalArgumentException(
                    label
                            + " is required and must not exceed "
                            + limit
                            + " characters."
            );
        }

        return value.trim();
    }

    public static void assertCancellable(
            FlywheelReleaseBatchStatus status,
            List<FlywheelReleaseItemStatus> items
    ) {
        if (
                status != FlywheelReleaseBatchStatus.DRAFT
                && status != FlywheelReleaseBatchStatus.IN_EXECUTION
        ) {
            throw new IllegalArgumentException(
                    "Only DRAFT or IN_EXECUTION batches may be cancelled."
            );
        }

        if (items.contains(FlywheelReleaseItemStatus.RELEASED)) {
            throw new IllegalArgumentException(
                    "A batch with recorded releases cannot be cancelled; finalize it instead."
            );
        }
    }
}
