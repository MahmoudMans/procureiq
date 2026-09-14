package com.procureiq.supplierperformance;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class SupplierPerformanceScoringService {

    private static final BigDecimal QUALITY_WEIGHT =
            new BigDecimal("0.25");

    private static final BigDecimal DELIVERY_WEIGHT =
            new BigDecimal("0.25");

    private static final BigDecimal COMMERCIAL_WEIGHT =
            new BigDecimal("0.20");

    private static final BigDecimal SERVICE_WEIGHT =
            new BigDecimal("0.15");

    private static final BigDecimal COMPLIANCE_WEIGHT =
            new BigDecimal("0.15");

    public BigDecimal weightedScore(
            BigDecimal quality,
            BigDecimal delivery,
            BigDecimal commercial,
            BigDecimal service,
            BigDecimal compliance
    ) {
        validateScore(
                quality
        );

        validateScore(
                delivery
        );

        validateScore(
                commercial
        );

        validateScore(
                service
        );

        validateScore(
                compliance
        );

        return quality
                .multiply(
                        QUALITY_WEIGHT
                )
                .add(
                        delivery.multiply(
                                DELIVERY_WEIGHT
                        )
                )
                .add(
                        commercial.multiply(
                                COMMERCIAL_WEIGHT
                        )
                )
                .add(
                        service.multiply(
                                SERVICE_WEIGHT
                        )
                )
                .add(
                        compliance.multiply(
                                COMPLIANCE_WEIGHT
                        )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public SupplierPerformanceBand band(
            BigDecimal weightedScore
    ) {
        validateScore(
                weightedScore
        );

        if (
                weightedScore.compareTo(
                        new BigDecimal(
                                "85.00"
                        )
                ) >= 0
        ) {
            return SupplierPerformanceBand.EXCELLENT;
        }

        if (
                weightedScore.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            return SupplierPerformanceBand.GOOD;
        }

        if (
                weightedScore.compareTo(
                        new BigDecimal(
                                "55.00"
                        )
                ) >= 0
        ) {
            return SupplierPerformanceBand.NEEDS_IMPROVEMENT;
        }

        return SupplierPerformanceBand.CRITICAL;
    }

    private void validateScore(
            BigDecimal score
    ) {
        if (
                score == null
                ||
                score.compareTo(
                        BigDecimal.ZERO
                ) < 0
                ||
                score.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Supplier performance scores must be between 0 and 100."
            );
        }
    }
}
