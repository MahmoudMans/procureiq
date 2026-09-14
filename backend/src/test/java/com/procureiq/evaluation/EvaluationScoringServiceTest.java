package com.procureiq.evaluation;

import com.procureiq.supplier.SupplierRiskLevel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EvaluationScoringServiceTest {

    private EvaluationScoringService
            scoringService;

    @BeforeEach
    void setUp() {
        scoringService =
                new EvaluationScoringService();
    }

    @Test
    void lowestPriceShouldReceiveFullPriceScore() {
        assertEquals(
                new BigDecimal("100.00"),
                scoringService
                        .priceScore(
                                new BigDecimal("8000.00"),
                                new BigDecimal("8000.00")
                        )
        );

        assertEquals(
                new BigDecimal("80.00"),
                scoringService
                        .priceScore(
                                new BigDecimal("8000.00"),
                                new BigDecimal("10000.00")
                        )
        );
    }

    @Test
    void riskScoreShouldRewardLowerRisk() {
        assertEquals(
                new BigDecimal("100.00"),
                scoringService
                        .riskScore(
                                SupplierRiskLevel.LOW
                        )
        );

        assertEquals(
                new BigDecimal("10.00"),
                scoringService
                        .riskScore(
                                SupplierRiskLevel.CRITICAL
                        )
        );
    }

    @Test
    void weightedTotalShouldRespectConfiguredWeights() {
        BigDecimal total =
                scoringService
                        .weightedTotal(
                                new BigDecimal("100.00"),
                                new BigDecimal("80.00"),
                                new BigDecimal("90.00"),
                                new BigDecimal("75.00"),
                                new BigDecimal("85.00"),
                                new BigDecimal("40.00"),
                                new BigDecimal("20.00"),
                                new BigDecimal("15.00"),
                                new BigDecimal("10.00"),
                                new BigDecimal("15.00")
                        );

        assertEquals(
                new BigDecimal("89.75"),
                total
        );
    }
}
