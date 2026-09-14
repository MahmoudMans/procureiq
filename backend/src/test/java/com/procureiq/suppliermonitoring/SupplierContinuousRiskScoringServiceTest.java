package com.procureiq.suppliermonitoring;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SupplierContinuousRiskScoringServiceTest {

    private SupplierContinuousRiskScoringService service;

    @BeforeEach
    void setUp() {
        service =
                new SupplierContinuousRiskScoringService();
    }

    @Test
    void shouldProduceLowRiskForHealthySupplier() {
        SupplierRiskScoreResult result =
                service.evaluate(
                        new SupplierRiskRawSignals(
                                true,
                                true,
                                false,
                                false,
                                5,
                                5,
                                0,
                                0,
                                0,
                                "APPROVED",
                                "GOOD",
                                0,
                                0,
                                BigDecimal.ZERO,
                                0,
                                0,
                                0,
                                0,
                                BigDecimal.ZERO,
                                new BigDecimal(
                                        "10000.00"
                                ),
                                new BigDecimal(
                                        "15.00"
                                )
                        )
                );

        assertEquals(
                SupplierContinuousRiskBand.LOW,
                result.riskBand()
        );

        assertEquals(
                SupplierRiskRecommendation.MONITOR,
                result.recommendation()
        );

        assertEquals(
                7,
                result.factors()
                        .size()
        );
    }

    @Test
    void shouldEscalateMaterialMultiFactorRisk() {
        SupplierRiskScoreResult result =
                service.evaluate(
                        new SupplierRiskRawSignals(
                                true,
                                false,
                                false,
                                true,
                                5,
                                2,
                                1,
                                1,
                                1,
                                "APPROVED",
                                "CRITICAL",
                                4,
                                2,
                                new BigDecimal(
                                        "90.00"
                                ),
                                3,
                                2,
                                2,
                                2,
                                new BigDecimal(
                                        "30000.00"
                                ),
                                new BigDecimal(
                                        "50000.00"
                                ),
                                new BigDecimal(
                                        "75.00"
                                )
                        )
                );

        assertEquals(
                SupplierContinuousRiskBand.CRITICAL,
                result.riskBand()
        );

        assertEquals(
                SupplierRiskRecommendation.CRITICAL_REVIEW,
                result.recommendation()
        );
    }

    @Test
    void shouldRecommendRequalificationAtFortyFive() {
        assertEquals(
                SupplierRiskRecommendation.REQUALIFY,
                service.recommendation(
                        new BigDecimal(
                                "45.00"
                        )
                )
        );
    }
}
