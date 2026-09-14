package com.procureiq.supplierresilience;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class SupplierResilienceScoringService {

    private static final BigDecimal HUNDRED =
            new BigDecimal(
                    "100.00"
            );

    public BigDecimal score(
            BigDecimal spendSharePct,
            BigDecimal categorySharePct,
            BigDecimal countrySharePct,
            int alternateSupplierCount,
            String supplierRiskLevel,
            BigDecimal latestPerformanceScore,
            long openCorrectiveActions,
            boolean activeContractCoverage,
            SupplierCapacityStatus capacityStatus
    ) {
        BigDecimal penalty =
                BigDecimal.ZERO;

        penalty =
                penalty.add(
                        spendPenalty(
                                spendSharePct
                        )
                );

        penalty =
                penalty.add(
                        categoryPenalty(
                                categorySharePct
                        )
                );

        penalty =
                penalty.add(
                        countryPenalty(
                                countrySharePct
                        )
                );

        penalty =
                penalty.add(
                        alternatePenalty(
                                alternateSupplierCount
                        )
                );

        penalty =
                penalty.add(
                        supplierRiskPenalty(
                                supplierRiskLevel
                        )
                );

        penalty =
                penalty.add(
                        performancePenalty(
                                latestPerformanceScore
                        )
                );

        penalty =
                penalty.add(
                        correctiveActionPenalty(
                                openCorrectiveActions
                        )
                );

        if (!activeContractCoverage) {
            penalty =
                    penalty.add(
                            new BigDecimal(
                                    "5.00"
                            )
                    );
        }

        penalty =
                penalty.add(
                        capacityPenalty(
                                capacityStatus
                        )
                );

        return HUNDRED
                .subtract(
                        penalty
                )
                .max(
                        BigDecimal.ZERO
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public SupplierResilienceBand band(
            BigDecimal score
    ) {
        if (
                score.compareTo(
                        new BigDecimal(
                                "80.00"
                        )
                ) >= 0
        ) {
            return SupplierResilienceBand.RESILIENT;
        }

        if (
                score.compareTo(
                        new BigDecimal(
                                "65.00"
                        )
                ) >= 0
        ) {
            return SupplierResilienceBand.WATCH;
        }

        if (
                score.compareTo(
                        new BigDecimal(
                                "45.00"
                        )
                ) >= 0
        ) {
            return SupplierResilienceBand.VULNERABLE;
        }

        return SupplierResilienceBand.CRITICAL;
    }

    private BigDecimal spendPenalty(
            BigDecimal value
    ) {
        if (
                value.compareTo(
                        new BigDecimal(
                                "25.00"
                        )
                ) > 0
        ) {
            return new BigDecimal(
                    "15.00"
            );
        }

        if (
                value.compareTo(
                        new BigDecimal(
                                "15.00"
                        )
                ) > 0
        ) {
            return new BigDecimal(
                    "10.00"
            );
        }

        if (
                value.compareTo(
                        new BigDecimal(
                                "10.00"
                        )
                ) > 0
        ) {
            return new BigDecimal(
                    "5.00"
            );
        }

        return BigDecimal.ZERO;
    }

    private BigDecimal categoryPenalty(
            BigDecimal value
    ) {
        if (
                value.compareTo(
                        new BigDecimal(
                                "60.00"
                        )
                ) > 0
        ) {
            return new BigDecimal(
                    "25.00"
            );
        }

        if (
                value.compareTo(
                        new BigDecimal(
                                "40.00"
                        )
                ) > 0
        ) {
            return new BigDecimal(
                    "18.00"
            );
        }

        if (
                value.compareTo(
                        new BigDecimal(
                                "25.00"
                        )
                ) > 0
        ) {
            return new BigDecimal(
                    "10.00"
            );
        }

        return BigDecimal.ZERO;
    }

    private BigDecimal countryPenalty(
            BigDecimal value
    ) {
        if (
                value.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) > 0
        ) {
            return new BigDecimal(
                    "10.00"
            );
        }

        if (
                value.compareTo(
                        new BigDecimal(
                                "35.00"
                        )
                ) > 0
        ) {
            return new BigDecimal(
                    "7.00"
            );
        }

        if (
                value.compareTo(
                        new BigDecimal(
                                "20.00"
                        )
                ) > 0
        ) {
            return new BigDecimal(
                    "4.00"
            );
        }

        return BigDecimal.ZERO;
    }

    private BigDecimal alternatePenalty(
            int count
    ) {
        if (count <= 0) {
            return new BigDecimal(
                    "20.00"
            );
        }

        if (count == 1) {
            return new BigDecimal(
                    "12.00"
            );
        }

        if (count == 2) {
            return new BigDecimal(
                    "6.00"
            );
        }

        return BigDecimal.ZERO;
    }

    private BigDecimal supplierRiskPenalty(
            String risk
    ) {
        if (risk == null) {
            return new BigDecimal(
                    "3.00"
            );
        }

        return switch (
                risk.toUpperCase()
        ) {
            case "CRITICAL" ->
                    new BigDecimal(
                            "20.00"
                    );

            case "HIGH" ->
                    new BigDecimal(
                            "12.00"
                    );

            case "MEDIUM" ->
                    new BigDecimal(
                            "5.00"
                    );

            default ->
                    BigDecimal.ZERO;
        };
    }

    private BigDecimal performancePenalty(
            BigDecimal performance
    ) {
        if (performance == null) {
            return new BigDecimal(
                    "3.00"
            );
        }

        if (
                performance.compareTo(
                        new BigDecimal(
                                "55.00"
                        )
                ) < 0
        ) {
            return new BigDecimal(
                    "15.00"
            );
        }

        if (
                performance.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) < 0
        ) {
            return new BigDecimal(
                    "8.00"
            );
        }

        if (
                performance.compareTo(
                        new BigDecimal(
                                "85.00"
                        )
                ) < 0
        ) {
            return new BigDecimal(
                    "3.00"
            );
        }

        return BigDecimal.ZERO;
    }

    private BigDecimal correctiveActionPenalty(
            long actions
    ) {
        if (actions >= 3) {
            return new BigDecimal(
                    "8.00"
            );
        }

        if (actions > 0) {
            return new BigDecimal(
                    "4.00"
            );
        }

        return BigDecimal.ZERO;
    }

    private BigDecimal capacityPenalty(
            SupplierCapacityStatus status
    ) {
        if (status == null) {
            return new BigDecimal(
                    "3.00"
            );
        }

        return switch (
                status
        ) {
            case ADEQUATE ->
                    BigDecimal.ZERO;

            case UNKNOWN ->
                    new BigDecimal(
                            "3.00"
                    );

            case CONSTRAINED ->
                    new BigDecimal(
                            "10.00"
                    );

            case AT_RISK ->
                    new BigDecimal(
                            "18.00"
                    );
        };
    }
}
