package com.procureiq.evaluation;

import com.procureiq.supplier.SupplierRiskLevel;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class EvaluationScoringService {

    private static final BigDecimal HUNDRED =
            new BigDecimal("100.00");

    public BigDecimal priceScore(
            BigDecimal lowestTotal,
            BigDecimal supplierTotal
    ) {
        if (
                supplierTotal.compareTo(
                        BigDecimal.ZERO
                ) == 0
        ) {
            return lowestTotal.compareTo(
                    BigDecimal.ZERO
            ) == 0
                    ? HUNDRED
                    : BigDecimal.ZERO
                            .setScale(2);
        }

        return clamp(
                lowestTotal
                        .multiply(HUNDRED)
                        .divide(
                                supplierTotal,
                                2,
                                RoundingMode.HALF_UP
                        )
        );
    }

    public BigDecimal deliveryScore(
            int fastestLeadTime,
            int supplierLeadTime
    ) {
        if (supplierLeadTime == 0) {
            return fastestLeadTime == 0
                    ? HUNDRED
                    : BigDecimal.ZERO
                            .setScale(2);
        }

        if (fastestLeadTime == 0) {
            return BigDecimal.ZERO
                    .setScale(2);
        }

        return clamp(
                BigDecimal.valueOf(
                        fastestLeadTime
                )
                        .multiply(HUNDRED)
                        .divide(
                                BigDecimal.valueOf(
                                        supplierLeadTime
                                ),
                                2,
                                RoundingMode.HALF_UP
                        )
        );
    }

    public BigDecimal supplierRatingScore(
            BigDecimal rating
    ) {
        if (rating == null) {
            return new BigDecimal(
                    "50.00"
            );
        }

        return clamp(
                rating
                        .multiply(
                                new BigDecimal(
                                        "20.00"
                                )
                        )
        );
    }

    public BigDecimal riskScore(
            SupplierRiskLevel riskLevel
    ) {
        if (riskLevel == null) {
            return new BigDecimal(
                    "50.00"
            );
        }

        return switch (riskLevel) {
            case LOW ->
                    new BigDecimal("100.00");

            case MEDIUM ->
                    new BigDecimal("75.00");

            case HIGH ->
                    new BigDecimal("40.00");

            case CRITICAL ->
                    new BigDecimal("10.00");
        };
    }

    public BigDecimal weightedTotal(
            BigDecimal priceScore,
            BigDecimal deliveryScore,
            BigDecimal supplierRatingScore,
            BigDecimal riskScore,
            BigDecimal qualityScore,
            BigDecimal priceWeight,
            BigDecimal deliveryWeight,
            BigDecimal supplierRatingWeight,
            BigDecimal riskWeight,
            BigDecimal qualityWeight
    ) {
        BigDecimal total =
                priceScore
                        .multiply(
                                priceWeight
                        )
                        .add(
                                deliveryScore
                                        .multiply(
                                                deliveryWeight
                                        )
                        )
                        .add(
                                supplierRatingScore
                                        .multiply(
                                                supplierRatingWeight
                                        )
                        )
                        .add(
                                riskScore
                                        .multiply(
                                                riskWeight
                                        )
                        )
                        .add(
                                qualityScore
                                        .multiply(
                                                qualityWeight
                                        )
                        )
                        .divide(
                                HUNDRED,
                                2,
                                RoundingMode.HALF_UP
                        );

        return clamp(total);
    }

    private BigDecimal clamp(
            BigDecimal value
    ) {
        if (
                value.compareTo(
                        BigDecimal.ZERO
                ) < 0
        ) {
            return BigDecimal.ZERO
                    .setScale(2);
        }

        if (
                value.compareTo(
                        HUNDRED
                ) > 0
        ) {
            return HUNDRED;
        }

        return value.setScale(
                2,
                RoundingMode.HALF_UP
        );
    }
}
