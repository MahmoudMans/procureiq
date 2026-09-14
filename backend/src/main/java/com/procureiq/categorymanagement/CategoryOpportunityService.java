package com.procureiq.categorymanagement;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class CategoryOpportunityService {

    public BigDecimal strategicValueScore(
            BigDecimal spend,
            long supplierCount
    ) {
        BigDecimal normalizedSpend =
                spend == null
                        ? BigDecimal.ZERO
                        : spend;

        BigDecimal score;

        if (
                normalizedSpend.compareTo(
                        new BigDecimal(
                                "1000000.00"
                        )
                ) >= 0
        ) {
            score =
                    new BigDecimal(
                            "90.00"
                    );
        } else if (
                normalizedSpend.compareTo(
                        new BigDecimal(
                                "500000.00"
                        )
                ) >= 0
        ) {
            score =
                    new BigDecimal(
                            "75.00"
                    );
        } else if (
                normalizedSpend.compareTo(
                        new BigDecimal(
                                "100000.00"
                        )
                ) >= 0
        ) {
            score =
                    new BigDecimal(
                            "60.00"
                    );
        } else if (
                normalizedSpend.compareTo(
                        new BigDecimal(
                                "25000.00"
                        )
                ) >= 0
        ) {
            score =
                    new BigDecimal(
                            "40.00"
                    );
        } else if (
                normalizedSpend.compareTo(
                        BigDecimal.ZERO
                ) > 0
        ) {
            score =
                    new BigDecimal(
                            "25.00"
                    );
        } else {
            score =
                    new BigDecimal(
                            "10.00"
                    );
        }

        score =
                score.add(
                        BigDecimal.valueOf(
                                Math.min(
                                        10,
                                        supplierCount
                                                * 2
                                )
                        )
                );

        return bounded(
                score
        );
    }

    public BigDecimal modeledOpportunityPct(
            long supplierCount,
            BigDecimal topSupplierShare
    ) {
        BigDecimal share =
                topSupplierShare == null
                        ? BigDecimal.ZERO
                        : topSupplierShare;

        if (
                supplierCount >= 6
                &&
                share.compareTo(
                        new BigDecimal(
                                "40.00"
                        )
                ) < 0
        ) {
            return new BigDecimal(
                    "5.00"
            );
        }

        if (
                supplierCount >= 4
                &&
                share.compareTo(
                        new BigDecimal(
                                "55.00"
                        )
                ) < 0
        ) {
            return new BigDecimal(
                    "3.50"
            );
        }

        if (supplierCount >= 3) {
            return new BigDecimal(
                    "2.00"
            );
        }

        return new BigDecimal(
                "1.00"
        );
    }

    public BigDecimal modeledOpportunityAmount(
            BigDecimal spend,
            long supplierCount,
            BigDecimal topSupplierShare
    ) {
        BigDecimal normalizedSpend =
                spend == null
                        ? BigDecimal.ZERO
                        : spend;

        return normalizedSpend
                .multiply(
                        modeledOpportunityPct(
                                supplierCount,
                                topSupplierShare
                        )
                )
                .divide(
                        new BigDecimal(
                                "100.00"
                        ),
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public CategoryMatrixPosition matrixPosition(
            BigDecimal strategicValueScore,
            BigDecimal supplyRiskScore
    ) {
        boolean highValue =
                strategicValueScore.compareTo(
                        new BigDecimal(
                                "60.00"
                        )
                ) >= 0;

        boolean highRisk =
                supplyRiskScore.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0;

        if (
                highValue
                &&
                highRisk
        ) {
            return CategoryMatrixPosition.CRITICAL_PRIORITY;
        }

        if (highValue) {
            return CategoryMatrixPosition.VALUE_OPTIMIZATION;
        }

        if (highRisk) {
            return CategoryMatrixPosition.RISK_MITIGATION;
        }

        return CategoryMatrixPosition.MANAGE;
    }

    private BigDecimal bounded(
            BigDecimal value
    ) {
        return value
                .max(
                        BigDecimal.ZERO
                )
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
