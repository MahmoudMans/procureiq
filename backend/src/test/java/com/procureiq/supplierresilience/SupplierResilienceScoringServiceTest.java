package com.procureiq.supplierresilience;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SupplierResilienceScoringServiceTest {

    private SupplierResilienceScoringService service;

    @BeforeEach
    void setUp() {
        service =
                new SupplierResilienceScoringService();
    }

    @Test
    void shouldReturnResilientScoreForDiversifiedHealthySupplier() {
        BigDecimal score =
                service.score(
                        new BigDecimal(
                                "5.00"
                        ),
                        new BigDecimal(
                                "20.00"
                        ),
                        new BigDecimal(
                                "10.00"
                        ),
                        3,
                        "LOW",
                        new BigDecimal(
                                "90.00"
                        ),
                        0,
                        true,
                        SupplierCapacityStatus.ADEQUATE
                );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                score
        );

        assertEquals(
                SupplierResilienceBand.RESILIENT,
                service.band(
                        score
                )
        );
    }

    @Test
    void shouldScoreConcentrationAndCapacityRisk() {
        BigDecimal score =
                service.score(
                        new BigDecimal(
                                "12.00"
                        ),
                        new BigDecimal(
                                "30.00"
                        ),
                        new BigDecimal(
                                "25.00"
                        ),
                        2,
                        "MEDIUM",
                        new BigDecimal(
                                "80.00"
                        ),
                        1,
                        true,
                        SupplierCapacityStatus.CONSTRAINED
                );

        assertEquals(
                new BigDecimal(
                        "53.00"
                ),
                score
        );

        assertEquals(
                SupplierResilienceBand.VULNERABLE,
                service.band(
                        score
                )
        );
    }

    @Test
    void shouldClassifySeverelyExposedSupplierAsCritical() {
        BigDecimal score =
                service.score(
                        new BigDecimal(
                                "40.00"
                        ),
                        new BigDecimal(
                                "75.00"
                        ),
                        new BigDecimal(
                                "60.00"
                        ),
                        0,
                        "CRITICAL",
                        new BigDecimal(
                                "45.00"
                        ),
                        4,
                        false,
                        SupplierCapacityStatus.AT_RISK
                );

        assertEquals(
                SupplierResilienceBand.CRITICAL,
                service.band(
                        score
                )
        );
    }
}
