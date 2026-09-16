package com.procureiq.flywheelvarianceexecution;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Financial residual and evidence coverage; neither is treatment completion. */
public record FlywheelVarianceExecutionExposureMetrics(
        BigDecimal financialResidualAmount,
        BigDecimal unrecordedVarianceAmount,
        BigDecimal evidenceCoveragePct
) {
    private static final BigDecimal MAX =
            new BigDecimal("999999999999999999.99");

    public static FlywheelVarianceExecutionExposureMetrics calculate(
            BigDecimal sourceAmount,
            BigDecimal capturedAmount,
            BigDecimal financialAmount
    ) {
        BigDecimal source = exact(sourceAmount);
        BigDecimal captured = exact(capturedAmount);
        BigDecimal financial = exact(financialAmount);

        if (source.signum() <= 0 || captured.compareTo(source) > 0
                || financial.compareTo(captured) > 0) {
            throw new IllegalArgumentException(
                    "Required: 0 <= financial amount <= captured amount <= positive source amount."
            );
        }

        return new FlywheelVarianceExecutionExposureMetrics(
                source.subtract(financial),
                source.subtract(captured),
                captured.multiply(new BigDecimal("100"))
                        .divide(source, 2, RoundingMode.HALF_UP)
        );
    }

    private static BigDecimal exact(BigDecimal value) {
        if (value == null) {
            throw new IllegalArgumentException("Exposure amounts are required.");
        }

        final BigDecimal normalized;

        try {
            normalized = value.setScale(2, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException exception) {
            throw new IllegalArgumentException(
                    "Exposure amounts must use exact cents.", exception
            );
        }

        if (normalized.signum() < 0 || normalized.compareTo(MAX) > 0) {
            throw new IllegalArgumentException(
                    "Exposure amount is outside the supported range."
            );
        }

        return normalized;
    }
}
