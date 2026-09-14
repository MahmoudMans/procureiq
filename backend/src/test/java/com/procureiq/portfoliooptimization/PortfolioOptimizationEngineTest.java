package com.procureiq.portfoliooptimization;

import com.procureiq.categorymanagement.CategoryInitiativePriority;
import com.procureiq.categorymanagement.CategoryInitiativeType;
import com.procureiq.categorymanagement.CategoryMatrixPosition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PortfolioOptimizationEngineTest {

    private PortfolioOptimizationEngine engine;

    @BeforeEach
    void setUp() {
        engine =
                new PortfolioOptimizationEngine();
    }

    @Test
    void shouldSelectHighestUtilityWithinBudget() {
        PortfolioOptimizationCandidate first =
                candidate(
                        "CATI-1",
                        CategoryInitiativePriority.CRITICAL,
                        CategoryMatrixPosition.VALUE_OPTIMIZATION,
                        "50000.00",
                        "5000.00",
                        "80.00",
                        "30.00"
                );

        PortfolioOptimizationCandidate second =
                candidate(
                        "CATI-2",
                        CategoryInitiativePriority.MEDIUM,
                        CategoryMatrixPosition.MANAGE,
                        "40000.00",
                        "1000.00",
                        "40.00",
                        "20.00"
                );

        PortfolioOptimizationResult result =
                engine.optimize(
                        List.of(
                                first,
                                second
                        ),
                        new PortfolioOptimizationConstraints(
                                new BigDecimal(
                                        "50000.00"
                                ),
                                5,
                                new BigDecimal(
                                        "70.00"
                                ),
                                new BigDecimal(
                                        "4000.00"
                                ),
                                true
                        )
                );

        assertEquals(
                1,
                result.selectedCount()
        );

        assertEquals(
                new BigDecimal(
                        "5000.00"
                ),
                result.selectedTargetSavings()
        );

        assertTrue(
                result.minimumTargetMet()
        );
    }

    @Test
    void shouldExcludeCriticalCategoryWhenDisabled() {
        PortfolioOptimizationCandidate candidate =
                candidate(
                        "CATI-CRITICAL",
                        CategoryInitiativePriority.CRITICAL,
                        CategoryMatrixPosition.CRITICAL_PRIORITY,
                        "25000.00",
                        "4000.00",
                        "90.00",
                        "75.00"
                );

        PortfolioOptimizationResult result =
                engine.optimize(
                        List.of(
                                candidate
                        ),
                        new PortfolioOptimizationConstraints(
                                new BigDecimal(
                                        "100000.00"
                                ),
                                10,
                                new BigDecimal(
                                        "100.00"
                                ),
                                BigDecimal.ZERO,
                                false
                        )
                );

        assertEquals(
                0,
                result.selectedCount()
        );

        assertEquals(
                PortfolioScenarioDecision.EXCLUDED,
                result.selections()
                        .get(
                                0
                        )
                        .decision()
        );
    }

    @Test
    void shouldEnforceAverageRiskConstraint() {
        PortfolioOptimizationCandidate first =
                candidate(
                        "CATI-HIGH-RISK",
                        CategoryInitiativePriority.HIGH,
                        CategoryMatrixPosition.VALUE_OPTIMIZATION,
                        "10000.00",
                        "2000.00",
                        "80.00",
                        "90.00"
                );

        PortfolioOptimizationResult result =
                engine.optimize(
                        List.of(
                                first
                        ),
                        new PortfolioOptimizationConstraints(
                                new BigDecimal(
                                        "50000.00"
                                ),
                                10,
                                new BigDecimal(
                                        "60.00"
                                ),
                                new BigDecimal(
                                        "1000.00"
                                ),
                                true
                        )
                );

        assertEquals(
                0,
                result.selectedCount()
        );

        assertFalse(
                result.minimumTargetMet()
        );
    }

    private PortfolioOptimizationCandidate candidate(
            String number,
            CategoryInitiativePriority priority,
            CategoryMatrixPosition matrix,
            String value,
            String savings,
            String strategicValue,
            String risk
    ) {
        return new PortfolioOptimizationCandidate(
                UUID.randomUUID(),
                number,
                "Category",
                number,
                CategoryInitiativeType.SOURCING_WAVE,
                priority,
                matrix,
                new BigDecimal(
                        value
                ),
                new BigDecimal(
                        savings
                ),
                new BigDecimal(
                        strategicValue
                ),
                new BigDecimal(
                        risk
                )
        );
    }
}
