package com.procureiq.investmentperformance;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InvestmentPerformanceMathServiceTest {

    private InvestmentPerformanceMathService service;

    @BeforeEach
    void setUp() {
        service =
                new InvestmentPerformanceMathService();
    }

    @Test
    void shouldCalculateOutperformingInvestmentEconomics() {
        InvestmentPerformanceMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "100.00"
                        ),
                        new BigDecimal(
                                "2160.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        ),
                        24,
                        new BigDecimal(
                                "800.00"
                        ),
                        new BigDecimal(
                                "1200.00"
                        ),
                        true
                );

        assertEquals(
                new BigDecimal(
                        "-200.00"
                ),
                result.fundingVarianceAmount()
        );

        assertEquals(
                new BigDecimal(
                        "-20.00"
                ),
                result.fundingVariancePct()
        );

        assertEquals(
                new BigDecimal(
                        "2400.00"
                ),
                result.realizedHorizonValueAmount()
        );

        assertEquals(
                new BigDecimal(
                        "1000.00"
                ),
                result.realizedTotalCostAmount()
        );

        assertEquals(
                new BigDecimal(
                        "1400.00"
                ),
                result.realizedNetValueAmount()
        );

        assertEquals(
                new BigDecimal(
                        "140.00"
                ),
                result.realizedRoiPct()
        );

        assertEquals(
                new BigDecimal(
                        "60.00"
                ),
                result.roiVariancePct()
        );

        assertEquals(
                new BigDecimal(
                        "3.0000"
                ),
                result.capitalEfficiencyMultiple()
        );

        assertEquals(
                InvestmentPerformanceHealth.OUTPERFORMING,
                result.health()
        );
    }

    @Test
    void shouldDetectUnderperformance() {
        InvestmentPerformanceMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "100.00"
                        ),
                        new BigDecimal(
                                "2000.00"
                        ),
                        new BigDecimal(
                                "70.00"
                        ),
                        24,
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "300.00"
                        ),
                        true
                );

        assertEquals(
                InvestmentPerformanceHealth.UNDERPERFORMING,
                result.health()
        );
    }

    @Test
    void shouldRemainUnassessedWithoutValidatedObservation() {
        InvestmentPerformanceMetricResult result =
                service.metrics(
                        new BigDecimal(
                                "1000.00"
                        ),
                        new BigDecimal(
                                "100.00"
                        ),
                        new BigDecimal(
                                "2000.00"
                        ),
                        new BigDecimal(
                                "70.00"
                        ),
                        24,
                        new BigDecimal(
                                "500.00"
                        ),
                        BigDecimal.ZERO,
                        false
                );

        assertEquals(
                InvestmentPerformanceHealth.UNASSESSED,
                result.health()
        );
    }
}
