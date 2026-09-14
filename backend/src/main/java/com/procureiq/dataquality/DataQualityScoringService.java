package com.procureiq.dataquality;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Component
public class DataQualityScoringService {

    private static final BigDecimal HUNDRED =
            new BigDecimal(
                    "100.00"
            );

    public BigDecimal domainScore(
            BigDecimal enabledWeight,
            BigDecimal affectedWeight
    ) {
        if (
                enabledWeight == null
                ||
                enabledWeight.compareTo(
                        BigDecimal.ZERO
                ) <= 0
        ) {
            return HUNDRED;
        }

        BigDecimal normalizedAffected =
                affectedWeight == null
                        ? BigDecimal.ZERO
                        : affectedWeight
                                .max(
                                        BigDecimal.ZERO
                                )
                                .min(
                                        enabledWeight
                                );

        return HUNDRED
                .multiply(
                        enabledWeight
                                .subtract(
                                        normalizedAffected
                                )
                )
                .divide(
                        enabledWeight,
                        2,
                        RoundingMode.HALF_UP
                )
                .max(
                        BigDecimal.ZERO
                )
                .min(
                        HUNDRED
                );
    }

    public BigDecimal overallScore(
            List<BigDecimal> domainScores
    ) {
        if (
                domainScores == null
                ||
                domainScores.isEmpty()
        ) {
            return HUNDRED;
        }

        return domainScores
                .stream()
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .divide(
                        BigDecimal.valueOf(
                                domainScores.size()
                        ),
                        2,
                        RoundingMode.HALF_UP
                );
    }
}
