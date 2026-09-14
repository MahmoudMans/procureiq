package com.procureiq.sustainability;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SustainabilityScoreServiceTest {

    private SustainabilityScoreService service;

    @BeforeEach
    void setUp() {
        service =
                new SustainabilityScoreService();
    }

    @Test
    void shouldCalculateWeightedEsgScore() {
        BigDecimal result =
                service.overallScore(
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        ),
                        new BigDecimal(
                                "70.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "81.50"
                ),
                result
        );

        assertEquals(
                SustainabilityRating.GOOD,
                service.rating(
                        result
                )
        );
    }

    @Test
    void shouldClassifyHighRiskSupplier() {
        BigDecimal result =
                service.overallScore(
                        new BigDecimal(
                                "50.00"
                        ),
                        new BigDecimal(
                                "40.00"
                        ),
                        new BigDecimal(
                                "30.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "41.50"
                ),
                result
        );

        assertEquals(
                SustainabilityRating.HIGH_RISK,
                service.rating(
                        result
                )
        );

        assertFalse(
                service.ratingEligibleForResponsibleSourcing(
                        SustainabilityRating.HIGH_RISK
                )
        );
    }

    @Test
    void shouldUseShorterReviewCycleForCriticalRisk() {
        assertEquals(
                60,
                service.reviewIntervalDays(
                        SustainabilityRating.CRITICAL
                )
        );

        assertTrue(
                service.ratingEligibleForResponsibleSourcing(
                        SustainabilityRating.LEADING
                )
        );
    }
}
