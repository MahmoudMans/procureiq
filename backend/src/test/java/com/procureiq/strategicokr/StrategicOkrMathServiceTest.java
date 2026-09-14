package com.procureiq.strategicokr;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StrategicOkrMathServiceTest {

    private StrategicOkrMathService service;

    @BeforeEach
    void setUp() {
        service =
                new StrategicOkrMathService();
    }

    @Test
    void shouldCalculateIncreaseProgress() {
        assertEquals(
                new BigDecimal(
                        "50.00"
                ),
                service.progress(
                        KeyResultDirection.INCREASE,
                        new BigDecimal(
                                "40.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        ),
                        new BigDecimal(
                                "60.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculateDecreaseProgress() {
        assertEquals(
                new BigDecimal(
                        "75.00"
                ),
                service.progress(
                        KeyResultDirection.DECREASE,
                        new BigDecimal(
                                "100.00"
                        ),
                        new BigDecimal(
                                "20.00"
                        ),
                        new BigDecimal(
                                "40.00"
                        )
                )
        );
    }

    @Test
    void shouldCapProgressAtOneHundred() {
        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                service.progress(
                        KeyResultDirection.INCREASE,
                        BigDecimal.ZERO,
                        new BigDecimal(
                                "100.00"
                        ),
                        new BigDecimal(
                                "150.00"
                        )
                )
        );
    }

    @Test
    void shouldCalculateWeightedObjectiveScore() {
        assertEquals(
                new BigDecimal(
                        "80.00"
                ),
                service.weightedScore(
                        List.of(
                                new StrategicOkrMathService.WeightedValue(
                                        new BigDecimal(
                                                "100.00"
                                        ),
                                        new BigDecimal(
                                                "60.00"
                                        )
                                ),
                                new StrategicOkrMathService.WeightedValue(
                                        new BigDecimal(
                                                "50.00"
                                        ),
                                        new BigDecimal(
                                                "40.00"
                                        )
                                )
                        )
                )
        );
    }

    @Test
    void shouldClassifyHealthDeterministically() {
        assertEquals(
                StrategicHealth.ACHIEVED,
                service.health(
                        new BigDecimal(
                                "100.00"
                        )
                )
        );

        assertEquals(
                StrategicHealth.ON_TRACK,
                service.health(
                        new BigDecimal(
                                "85.00"
                        )
                )
        );

        assertEquals(
                StrategicHealth.AT_RISK,
                service.health(
                        new BigDecimal(
                                "65.00"
                        )
                )
        );

        assertEquals(
                StrategicHealth.OFF_TRACK,
                service.health(
                        new BigDecimal(
                                "30.00"
                        )
                )
        );
    }

    @Test
    void shouldUseFreshOperatingAuthorityForHighConfidence() {
        Instant now =
                Instant.parse(
                        "2026-09-14T12:00:00Z"
                );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                service.confidence(
                        KeyResultSourceType.OPERATING_RHYTHM_SLA_ATTAINMENT,
                        Instant.parse(
                                "2026-09-10T12:00:00Z"
                        ),
                        now
                )
        );
    }
}
