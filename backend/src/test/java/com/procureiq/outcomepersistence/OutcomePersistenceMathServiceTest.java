package com.procureiq.outcomepersistence;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OutcomePersistenceMathServiceTest {

    private OutcomePersistenceMathService service;

    @BeforeEach
    void setUp() {
        service =
                new OutcomePersistenceMathService();
    }

    @Test
    void shouldRemainUnassessedWithoutValidatedObservation() {
        PersistenceMetricResult result =
                service.persistence(
                        new BigDecimal(
                                "10.00"
                        ),
                        BigDecimal.ZERO,
                        false
                );

        assertEquals(
                PersistenceHealth.UNASSESSED,
                result.health()
        );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                result.decayPoints()
        );
    }

    @Test
    void shouldDetectSustainedValue() {
        PersistenceMetricResult result =
                service.persistence(
                        new BigDecimal(
                                "10.00"
                        ),
                        new BigDecimal(
                                "9.50"
                        ),
                        true
                );

        assertEquals(
                new BigDecimal(
                        "95.00"
                ),
                result.persistencePct()
        );

        assertEquals(
                PersistenceHealth.SUSTAINED,
                result.health()
        );
    }

    @Test
    void shouldDetectBenefitDecay() {
        PersistenceMetricResult result =
                service.persistence(
                        new BigDecimal(
                                "10.00"
                        ),
                        new BigDecimal(
                                "6.00"
                        ),
                        true
                );

        assertEquals(
                new BigDecimal(
                        "60.00"
                ),
                result.persistencePct()
        );

        assertEquals(
                new BigDecimal(
                        "4.00"
                ),
                result.decayPoints()
        );

        assertEquals(
                PersistenceHealth.DECAYING,
                result.health()
        );
    }

    @Test
    void shouldDetectRegression() {
        PersistenceMetricResult result =
                service.persistence(
                        new BigDecimal(
                                "10.00"
                        ),
                        new BigDecimal(
                                "3.00"
                        ),
                        true
                );

        assertEquals(
                PersistenceHealth.REGRESSED,
                result.health()
        );
    }

    @Test
    void shouldCalculatePortfolioHealthFromAssessedPlans() {
        PersistenceHealth result =
                service.portfolioHealth(
                        List.of(
                                new PersistenceMetricResult(
                                        new BigDecimal(
                                                "95.00"
                                        ),
                                        BigDecimal.ZERO,
                                        PersistenceHealth.SUSTAINED
                                ),
                                new PersistenceMetricResult(
                                        new BigDecimal(
                                                "85.00"
                                        ),
                                        BigDecimal.ZERO,
                                        PersistenceHealth.WATCH
                                )
                        )
                );

        assertEquals(
                PersistenceHealth.SUSTAINED,
                result
        );
    }
}
