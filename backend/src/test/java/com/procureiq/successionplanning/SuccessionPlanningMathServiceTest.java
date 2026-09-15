package com.procureiq.successionplanning;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SuccessionPlanningMathServiceTest {

    private SuccessionPlanningMathService service;

    @BeforeEach
    void setUp() {
        service =
                new SuccessionPlanningMathService();
    }

    @Test
    void shouldCalculateCandidateEvidenceScore() {
        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                service.candidateEvidenceScore(
                        4,
                        4,
                        new BigDecimal(
                                "80.00"
                        )
                )
        );
    }

    @Test
    void shouldClassifyNearReadyCandidate() {
        assertEquals(
                SuccessionCandidateReadiness.NEAR_READY,
                service.candidateReadiness(
                        4,
                        3
                )
        );
    }

    @Test
    void shouldPenalizeSinglePointFailure() {
        SuccessionPolicyScore score =
                service.policyScore(
                        SuccessionCriticality.CRITICAL,
                        3,
                        1,
                        true
                );

        assertEquals(
                SuccessionHealth.CRITICAL,
                score.health()
        );

        assertTrue(
                score.policyScore()
                        .compareTo(
                                new BigDecimal(
                                        "20.00"
                                )
                        ) < 0
        );
    }

    @Test
    void shouldProduceResilientPortfolio() {
        SuccessionPortfolioScore score =
                service.portfolioScore(
                        2,
                        2,
                        List.of(
                                new BigDecimal(
                                        "100.00"
                                ),
                                new BigDecimal(
                                        "100.00"
                                )
                        ),
                        0,
                        0
                );

        assertEquals(
                new BigDecimal(
                        "100.00"
                ),
                score.successionScore()
        );

        assertEquals(
                SuccessionHealth.RESILIENT,
                score.health()
        );
    }
}
