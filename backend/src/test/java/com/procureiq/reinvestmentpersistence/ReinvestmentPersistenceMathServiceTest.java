package com.procureiq.reinvestmentpersistence;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReinvestmentPersistenceMathServiceTest {

    private ReinvestmentPersistenceMathService service;

    @BeforeEach
    void setUp() {
        service =
                new ReinvestmentPersistenceMathService();
    }

    @Test
    void shouldDetectCompoundingOutcome() {
        ReinvestmentPersistenceMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "1800.00"
                        ),
                        new BigDecimal(
                                "1800.00"
                        ),
                        new BigDecimal(
                                "700.00"
                        ),
                        new BigDecimal(
                                "1100.00"
                        ),
                        new BigDecimal(
                                "63.64"
                        ),
                        12,
                        new BigDecimal(
                                "2100.00"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        true
                );

        assertEquals(
                ReinvestmentPersistenceHealth.COMPOUNDING,
                result.health()
        );

        assertEquals(
                new BigDecimal(
                        "116.67"
                ),
                result.valuePersistencePct()
        );

        assertEquals(
                new BigDecimal(
                        "300.00"
                ),
                result.compoundingValueAmount()
        );
    }

    @Test
    void shouldDetectSustainedOutcome() {
        ReinvestmentPersistenceMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "1800.00"
                        ),
                        new BigDecimal(
                                "1800.00"
                        ),
                        new BigDecimal(
                                "700.00"
                        ),
                        new BigDecimal(
                                "1100.00"
                        ),
                        new BigDecimal(
                                "63.64"
                        ),
                        12,
                        new BigDecimal(
                                "1700.00"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        true
                );

        assertEquals(
                ReinvestmentPersistenceHealth.SUSTAINED,
                result.health()
        );
    }

    @Test
    void shouldDetectDecay() {
        ReinvestmentPersistenceMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "1800.00"
                        ),
                        new BigDecimal(
                                "1800.00"
                        ),
                        new BigDecimal(
                                "700.00"
                        ),
                        new BigDecimal(
                                "1100.00"
                        ),
                        new BigDecimal(
                                "63.64"
                        ),
                        12,
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        true
                );

        assertEquals(
                ReinvestmentPersistenceHealth.DECAYING,
                result.health()
        );

        assertEquals(
                new BigDecimal(
                        "800.00"
                ),
                result.decayedValueAmount()
        );
    }

    @Test
    void shouldRemainUnassessedWithoutValidatedPersistenceEvidence() {
        ReinvestmentPersistenceMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "1800.00"
                        ),
                        new BigDecimal(
                                "1800.00"
                        ),
                        new BigDecimal(
                                "700.00"
                        ),
                        new BigDecimal(
                                "1100.00"
                        ),
                        new BigDecimal(
                                "63.64"
                        ),
                        12,
                        BigDecimal.ZERO,
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        false
                );

        assertEquals(
                ReinvestmentPersistenceHealth.UNASSESSED,
                result.health()
        );
    }
}
