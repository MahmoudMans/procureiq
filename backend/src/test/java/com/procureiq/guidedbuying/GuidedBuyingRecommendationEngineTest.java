package com.procureiq.guidedbuying;

import com.procureiq.compliance.ProcurementPolicyType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GuidedBuyingRecommendationEngineTest {

    private GuidedBuyingRecommendationEngine engine;

    @BeforeEach
    void setUp() {
        engine =
                new GuidedBuyingRecommendationEngine();
    }

    @Test
    void shouldReturnDirectBuyWhenNoControlsMatch() {
        GuidedBuyingRecommendationEngine.Recommendation result =
                engine.recommend(
                        new BigDecimal(
                                "2500.00"
                        ),
                        "EUR",
                        "LOW",
                        List.of(
                                new GuidedBuyingRecommendationEngine.PolicyRule(
                                        "SRC",
                                        ProcurementPolicyType.COMPETITIVE_SOURCING_THRESHOLD,
                                        new BigDecimal(
                                                "10000.00"
                                        ),
                                        "EUR"
                                )
                        )
                );

        assertEquals(
                GuidedBuyingRoute.DIRECT_BUY,
                result.route()
        );
    }

    @Test
    void shouldRequireCompetitiveSourcingAtThreshold() {
        GuidedBuyingRecommendationEngine.Recommendation result =
                engine.recommend(
                        new BigDecimal(
                                "15000.00"
                        ),
                        "EUR",
                        "LOW",
                        List.of(
                                new GuidedBuyingRecommendationEngine.PolicyRule(
                                        "SRC",
                                        ProcurementPolicyType.COMPETITIVE_SOURCING_THRESHOLD,
                                        new BigDecimal(
                                                "10000.00"
                                        ),
                                        "EUR"
                                )
                        )
                );

        assertEquals(
                GuidedBuyingRoute.COMPETITIVE_SOURCING,
                result.route()
        );

        assertTrue(
                result.signals()
                        .getFirst()
                        .contains(
                                "competitive sourcing"
                        )
        );
    }

    @Test
    void shouldReturnMultiControlWhenMultiplePoliciesApply() {
        GuidedBuyingRecommendationEngine.Recommendation result =
                engine.recommend(
                        new BigDecimal(
                                "60000.00"
                        ),
                        "EUR",
                        "CRITICAL",
                        List.of(
                                new GuidedBuyingRecommendationEngine.PolicyRule(
                                        "SRC",
                                        ProcurementPolicyType.COMPETITIVE_SOURCING_THRESHOLD,
                                        new BigDecimal(
                                                "10000.00"
                                        ),
                                        "EUR"
                                ),
                                new GuidedBuyingRecommendationEngine.PolicyRule(
                                        "CONTRACT",
                                        ProcurementPolicyType.CONTRACT_REQUIRED_THRESHOLD,
                                        new BigDecimal(
                                                "50000.00"
                                        ),
                                        "EUR"
                                ),
                                new GuidedBuyingRecommendationEngine.PolicyRule(
                                        "RISK",
                                        ProcurementPolicyType.HIGH_RISK_SUPPLIER_RESTRICTION,
                                        null,
                                        null
                                )
                        )
                );

        assertEquals(
                GuidedBuyingRoute.MULTI_CONTROL,
                result.route()
        );

        assertEquals(
                3,
                result.signals()
                        .size()
        );
    }
}
