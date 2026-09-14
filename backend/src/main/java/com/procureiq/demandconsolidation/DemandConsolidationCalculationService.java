package com.procureiq.demandconsolidation;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class DemandConsolidationCalculationService {

    private static final BigDecimal MAX_LEVERAGE =
            new BigDecimal(
                    "15.00"
            );

    public BigDecimal leveragePercentage(
            BigDecimal totalValue,
            int departmentCount,
            int intakeCount
    ) {
        if (
                totalValue == null
                ||
                totalValue.compareTo(
                        BigDecimal.ZERO
                ) < 0
        ) {
            throw new IllegalArgumentException(
                    "Consolidated demand value cannot be negative."
            );
        }

        if (
                departmentCount < 2
                ||
                intakeCount < 2
        ) {
            throw new IllegalArgumentException(
                    "Demand consolidation requires at least two intakes across two departments."
            );
        }

        BigDecimal leverage =
                new BigDecimal(
                        "2.00"
                );

        BigDecimal departmentUplift =
                BigDecimal.valueOf(
                        Math.min(
                                5,
                                departmentCount - 1L
                        )
                );

        BigDecimal intakeUplift =
                BigDecimal.valueOf(
                        Math.min(
                                3.0,
                                Math.max(
                                        0,
                                        intakeCount - 2
                                )
                                        * 0.5
                        )
                );

        BigDecimal valueUplift;

        if (
                totalValue.compareTo(
                        new BigDecimal(
                                "250000"
                        )
                ) >= 0
        ) {
            valueUplift =
                    new BigDecimal(
                            "5.00"
                    );
        } else if (
                totalValue.compareTo(
                        new BigDecimal(
                                "100000"
                        )
                ) >= 0
        ) {
            valueUplift =
                    new BigDecimal(
                            "3.00"
                    );
        } else if (
                totalValue.compareTo(
                        new BigDecimal(
                                "50000"
                        )
                ) >= 0
        ) {
            valueUplift =
                    new BigDecimal(
                            "2.00"
                    );
        } else if (
                totalValue.compareTo(
                        new BigDecimal(
                                "25000"
                        )
                ) >= 0
        ) {
            valueUplift =
                    new BigDecimal(
                            "1.00"
                    );
        } else {
            valueUplift =
                    BigDecimal.ZERO;
        }

        leverage =
                leverage
                        .add(
                                departmentUplift
                        )
                        .add(
                                intakeUplift
                        )
                        .add(
                                valueUplift
                        )
                        .min(
                                MAX_LEVERAGE
                        );

        return leverage.setScale(
                2,
                RoundingMode.HALF_UP
        );
    }

    public BigDecimal expectedSavings(
            BigDecimal consolidatedValue,
            BigDecimal leveragePercentage
    ) {
        if (
                consolidatedValue == null
                ||
                leveragePercentage == null
        ) {
            throw new IllegalArgumentException(
                    "Consolidated value and leverage percentage are required."
            );
        }

        return consolidatedValue
                .multiply(
                        leveragePercentage
                )
                .divide(
                        new BigDecimal(
                                "100.00"
                        ),
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
