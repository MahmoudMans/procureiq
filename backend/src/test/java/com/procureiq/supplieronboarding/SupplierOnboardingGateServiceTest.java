package com.procureiq.supplieronboarding;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SupplierOnboardingGateServiceTest {

    private SupplierOnboardingGateService service;

    @BeforeEach
    void setUp() {
        service =
                new SupplierOnboardingGateService();
    }

    @Test
    void shouldRequireRiskBasedApprovalRoutes() {
        assertEquals(
                List.of(
                        OnboardingApprovalLevel.PROCUREMENT
                ),
                service.requiredApprovalLevels(
                        SupplierOnboardingRiskTier.LOW
                )
        );

        assertEquals(
                List.of(
                        OnboardingApprovalLevel.PROCUREMENT,
                        OnboardingApprovalLevel.COMPLIANCE,
                        OnboardingApprovalLevel.RISK
                ),
                service.requiredApprovalLevels(
                        SupplierOnboardingRiskTier.CRITICAL
                )
        );
    }

    @Test
    void shouldClearSupplierOnlyWhenEveryGatePasses() {
        OnboardingGateEvaluation evaluation =
                service.evaluate(
                        5,
                        5,
                        0,
                        4,
                        4,
                        3,
                        3
                );

        assertTrue(
                evaluation.activationEligible()
        );

        assertTrue(
                evaluation.reasons()
                        .isEmpty()
        );
    }

    @Test
    void shouldExplainBlockedActivation() {
        OnboardingGateEvaluation evaluation =
                service.evaluate(
                        5,
                        4,
                        1,
                        5,
                        4,
                        3,
                        2
                );

        assertFalse(
                evaluation.activationEligible()
        );

        assertEquals(
                4,
                evaluation.reasons()
                        .size()
        );
    }

    @Test
    void shouldUseShorterSlaForHigherRisk() {
        assertEquals(
                10,
                service.slaDays(
                        SupplierOnboardingRiskTier.LOW
                )
        );

        assertEquals(
                3,
                service.slaDays(
                        SupplierOnboardingRiskTier.CRITICAL
                )
        );

        assertEquals(
                90,
                service.requalificationDays(
                        SupplierOnboardingRiskTier.CRITICAL
                )
        );
    }
}
