package com.procureiq.sustainability;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class SustainabilityScoreService {

    private static final BigDecimal ENVIRONMENT_WEIGHT =
            new BigDecimal(
                    "0.40"
            );

    private static final BigDecimal SOCIAL_WEIGHT =
            new BigDecimal(
                    "0.35"
            );

    private static final BigDecimal GOVERNANCE_WEIGHT =
            new BigDecimal(
                    "0.25"
            );

    public BigDecimal overallScore(
            BigDecimal environmentalScore,
            BigDecimal socialScore,
            BigDecimal governanceScore
    ) {
        validateScore(
                environmentalScore
        );

        validateScore(
                socialScore
        );

        validateScore(
                governanceScore
        );

        return environmentalScore
                .multiply(
                        ENVIRONMENT_WEIGHT
                )
                .add(
                        socialScore
                                .multiply(
                                        SOCIAL_WEIGHT
                                )
                )
                .add(
                        governanceScore
                                .multiply(
                                        GOVERNANCE_WEIGHT
                                )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    public SustainabilityRating rating(
            BigDecimal overallScore
    ) {
        validateScore(
                overallScore
        );

        if (
                overallScore.compareTo(
                        new BigDecimal(
                                "85.00"
                        )
                ) >= 0
        ) {
            return SustainabilityRating.LEADING;
        }

        if (
                overallScore.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            return SustainabilityRating.GOOD;
        }

        if (
                overallScore.compareTo(
                        new BigDecimal(
                                "55.00"
                        )
                ) >= 0
        ) {
            return SustainabilityRating.MODERATE;
        }

        if (
                overallScore.compareTo(
                        new BigDecimal(
                                "40.00"
                        )
                ) >= 0
        ) {
            return SustainabilityRating.HIGH_RISK;
        }

        return SustainabilityRating.CRITICAL;
    }

    public int reviewIntervalDays(
            SustainabilityRating rating
    ) {
        return switch (
                rating
        ) {
            case LEADING,
                 GOOD ->
                    365;

            case MODERATE ->
                    180;

            case HIGH_RISK ->
                    90;

            case CRITICAL ->
                    60;
        };
    }

    public boolean ratingEligibleForResponsibleSourcing(
            SustainabilityRating rating
    ) {
        return rating
                        == SustainabilityRating.LEADING
                ||
                rating
                        == SustainabilityRating.GOOD
                ||
                rating
                        == SustainabilityRating.MODERATE;
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
                    "Sustainability scores must be between 0 and 100."
            );
        }
    }
}
