package com.procureiq.budget;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class BudgetCalculationService {

    private static final BigDecimal HUNDRED =
            new BigDecimal("100.00");

    public BigDecimal utilizationPercent(
            BigDecimal exposure,
            BigDecimal budget
    ) {
        if (
                budget == null
                ||
                budget.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return BigDecimal.ZERO
                    .setScale(2);
        }

        return exposure
                .multiply(HUNDRED)
                .divide(
                        budget,
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public BudgetAlertLevel alertLevel(
            BigDecimal forecastUtilizationPercent,
            BigDecimal warningThresholdPercent
    ) {
        if (
                forecastUtilizationPercent
                        .compareTo(
                                HUNDRED
                        ) > 0
        ) {
            return BudgetAlertLevel.EXCEEDED;
        }

        if (
                forecastUtilizationPercent
                        .compareTo(
                                warningThresholdPercent
                        ) >= 0
        ) {
            return BudgetAlertLevel.WARNING;
        }

        return BudgetAlertLevel.HEALTHY;
    }

    public BigDecimal remaining(
            BigDecimal budget,
            BigDecimal exposure
    ) {
        return budget
                .subtract(exposure)
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
