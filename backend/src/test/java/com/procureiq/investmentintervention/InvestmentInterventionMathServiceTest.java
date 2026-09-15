package com.procureiq.investmentintervention;

import com.procureiq.investmentperformance.InvestmentPerformanceHealth;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InvestmentInterventionMathServiceTest {

    private InvestmentInterventionMathService service;

    @BeforeEach
    void setUp() {
        service =
                new InvestmentInterventionMathService();
    }

    @Test
    void shouldRecommendReallocationForMaterialUnderperformance() {
        InvestmentInterventionRecommendationResult result =
                service.recommend(
                        InvestmentPerformanceHealth.UNDERPERFORMING,
                        new BigDecimal(
                                "-40.00"
                        ),
                        new BigDecimal(
                                "0.7500"
                        ),
                        new BigDecimal(
                                "1000.00"
                        )
                );

        assertEquals(
                InvestmentInterventionAction.REALLOCATE_UNRELEASED,
                result.action()
        );

        assertEquals(
                new BigDecimal(
                        "1000.00"
                ),
                result.recommendedAffectedCapitalAmount()
        );
    }

    @Test
    void shouldRecommendReductionForWatchInvestment() {
        InvestmentInterventionRecommendationResult result =
                service.recommend(
                        InvestmentPerformanceHealth.WATCH,
                        new BigDecimal(
                                "-20.00"
                        ),
                        new BigDecimal(
                                "1.2000"
                        ),
                        new BigDecimal(
                                "800.00"
                        )
                );

        assertEquals(
                InvestmentInterventionAction.REDUCE_UNRELEASED,
                result.action()
        );

        assertEquals(
                new BigDecimal(
                        "400.00"
                ),
                result.recommendedAffectedCapitalAmount()
        );
    }

    @Test
    void shouldRecommendContinueForOnTrackInvestment() {
        InvestmentInterventionRecommendationResult result =
                service.recommend(
                        InvestmentPerformanceHealth.ON_TRACK,
                        new BigDecimal(
                                "-5.00"
                        ),
                        new BigDecimal(
                                "1.5000"
                        ),
                        new BigDecimal(
                                "500.00"
                        )
                );

        assertEquals(
                InvestmentInterventionAction.CONTINUE,
                result.action()
        );

        assertEquals(
                new BigDecimal(
                        "0.00"
                ),
                result.recommendedAffectedCapitalAmount()
        );
    }

    @Test
    void shouldNeverRecommendCapitalActionWhenNothingRemains() {
        InvestmentInterventionRecommendationResult result =
                service.recommend(
                        InvestmentPerformanceHealth.UNDERPERFORMING,
                        new BigDecimal(
                                "-100.00"
                        ),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO
                );

        assertEquals(
                InvestmentInterventionAction.CONTINUE,
                result.action()
        );
    }
}
