package com.procureiq.capitalflywheel;

import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceHealth;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CapitalFlywheelMathServiceTest {

    private CapitalFlywheelMathService service;

    @BeforeEach
    void setUp() {
        service =
                new CapitalFlywheelMathService();
    }

    @Test
    void shouldMeasureSingleCycleValuePerOriginalCapital() {
        CapitalFlywheelMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                cycle(
                                        "700.00",
                                        "1.8000",
                                        "100.00",
                                        "100.00",
                                        "0.00",
                                        "0.00",
                                        "63.64",
                                        ReinvestmentPersistenceHealth.SUSTAINED
                                )
                        ),
                        new BigDecimal(
                                "0.20"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        )
                );

        assertEquals(
                1,
                result.cycleCount()
        );

        assertEquals(
                new BigDecimal(
                        "0.7000"
                ),
                result.cumulativeValueMultiple()
        );

        assertEquals(
                CapitalFlywheelHealth.SINGLE_CYCLE,
                result.health()
        );

        assertEquals(
                CapitalFlywheelRecommendation.CONTINUE,
                result.recommendation()
        );
    }

    @Test
    void shouldDetectCompoundingAcrossCycles() {
        CapitalFlywheelMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                cycle(
                                        "700.00",
                                        "1.8000",
                                        "100.00",
                                        "100.00",
                                        "0.00",
                                        "0.00",
                                        "63.64",
                                        ReinvestmentPersistenceHealth.SUSTAINED
                                ),
                                cycle(
                                        "900.00",
                                        "2.1000",
                                        "120.00",
                                        "120.00",
                                        "300.00",
                                        "0.00",
                                        "80.00",
                                        ReinvestmentPersistenceHealth.COMPOUNDING
                                )
                        ),
                        new BigDecimal(
                                "0.20"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "1.6000"
                ),
                result.cumulativeValueMultiple()
        );

        assertEquals(
                CapitalFlywheelHealth.COMPOUNDING,
                result.health()
        );

        assertEquals(
                CapitalFlywheelRecommendation.CONTINUE,
                result.recommendation()
        );

        assertFalse(
                result.diminishingReturns()
        );
    }

    @Test
    void shouldDetectDiminishingReturns() {
        CapitalFlywheelMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                cycle(
                                        "700.00",
                                        "1.8000",
                                        "100.00",
                                        "100.00",
                                        "0.00",
                                        "0.00",
                                        "63.64",
                                        ReinvestmentPersistenceHealth.SUSTAINED
                                ),
                                cycle(
                                        "400.00",
                                        "1.3000",
                                        "90.00",
                                        "70.00",
                                        "0.00",
                                        "250.00",
                                        "35.00",
                                        ReinvestmentPersistenceHealth.SUSTAINED
                                )
                        ),
                        new BigDecimal(
                                "0.20"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        )
                );

        assertTrue(
                result.diminishingReturns()
        );

        assertEquals(
                CapitalFlywheelHealth.DIMINISHING,
                result.health()
        );

        assertEquals(
                CapitalFlywheelRecommendation.HOLD,
                result.recommendation()
        );
    }

    @Test
    void shouldRecommendStopForExhaustedCycle() {
        CapitalFlywheelMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                cycle(
                                        "-50.00",
                                        "0.9000",
                                        "40.00",
                                        "40.00",
                                        "0.00",
                                        "900.00",
                                        "-5.00",
                                        ReinvestmentPersistenceHealth.REGRESSED
                                )
                        ),
                        new BigDecimal(
                                "0.20"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        )
                );

        assertEquals(
                CapitalFlywheelHealth.EXHAUSTED,
                result.health()
        );

        assertEquals(
                CapitalFlywheelRecommendation.STOP,
                result.recommendation()
        );
    }

    private CapitalFlywheelCycleMetricInput cycle(
            String projectedNetValue,
            String efficiencyMultiple,
            String valuePersistence,
            String efficiencyRetention,
            String compoundingValue,
            String decay,
            String projectedRoi,
            ReinvestmentPersistenceHealth health
    ) {
        return new CapitalFlywheelCycleMetricInput(
                new BigDecimal(
                        projectedNetValue
                ),
                new BigDecimal(
                        efficiencyMultiple
                ),
                new BigDecimal(
                        valuePersistence
                ),
                new BigDecimal(
                        efficiencyRetention
                ),
                new BigDecimal(
                        compoundingValue
                ),
                new BigDecimal(
                        decay
                ),
                new BigDecimal(
                        projectedRoi
                ),
                health
        );
    }
}
