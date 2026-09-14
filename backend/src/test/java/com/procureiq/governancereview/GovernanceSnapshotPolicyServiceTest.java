package com.procureiq.governancereview;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GovernanceSnapshotPolicyServiceTest {

    private GovernanceSnapshotPolicyService service;

    @BeforeEach
    void setUp() {
        service =
                new GovernanceSnapshotPolicyService();
    }

    @Test
    void shouldClassifyCriticalSupplierRisk() {
        assertEquals(
                GovernanceSeverity.CRITICAL,
                service.supplierRiskSeverity(
                        "CRITICAL"
                )
        );
    }

    @Test
    void shouldClassifyCriticalCategoryPriority() {
        assertEquals(
                GovernanceSeverity.CRITICAL,
                service.categorySeverity(
                        "CRITICAL_PRIORITY"
                )
        );
    }

    @Test
    void shouldClassifyPortfolioWithLargeValueAtRiskAsCritical() {
        assertEquals(
                GovernanceSeverity.CRITICAL,
                service.portfolioSeverity(
                        new BigDecimal(
                                "100.00"
                        ),
                        new BigDecimal(
                                "55.00"
                        ),
                        new BigDecimal(
                                "10.00"
                        )
                )
        );
    }
}
