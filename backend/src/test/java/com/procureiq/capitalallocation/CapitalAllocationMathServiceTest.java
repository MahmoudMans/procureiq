package com.procureiq.capitalallocation;

import com.procureiq.strategicvalue.StrategicValueHealth;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CapitalAllocationMathServiceTest {

    private CapitalAllocationMathService service;

    @BeforeEach
    void setUp() {
        service =
                new CapitalAllocationMathService();
    }

    @Test
    void shouldRankStrongHighRoiInvestmentForFunding() {
        CapitalAllocationPriorityResult result =
                service.priority(
                        new BigDecimal(
                                "50.00"
                        ),
                        new BigDecimal(
                                "12.00"
                        ),
                        new BigDecimal(
                                "90.00"
                        ),
                        StrategicValueHealth.STRONG,
                        new BigDecimal(
                                "10000.00"
                        )
                );

        assertEquals(
                new BigDecimal(
                        "83.50"
                ),
                result.priorityScore()
        );

        assertEquals(
                CapitalAllocationDecision.FUND,
                result.recommendation()
        );
    }

    @Test
    void shouldRejectNegativeValueCase() {
        CapitalAllocationPriorityResult result =
                service.priority(
                        new BigDecimal(
                                "-10.00"
                        ),
                        new BigDecimal(
                                "36.00"
                        ),
                        new BigDecimal(
                                "80.00"
                        ),
                        StrategicValueHealth.WATCH,
                        new BigDecimal(
                                "-100.00"
                        )
                );

        assertEquals(
                CapitalAllocationDecision.REJECT,
                result.recommendation()
        );
    }

    @Test
    void shouldCalculateBudgetUtilizationAndOpportunityCost() {
        CapitalAllocationPortfolioResult result =
                service.portfolio(
                        new BigDecimal(
                                "1000.00"
                        ),
                        List.of(
                                new CapitalAllocationMathService.CapitalAllocationPortfolioItem(
                                        CapitalAllocationDecision.FUND,
                                        new BigDecimal(
                                                "600.00"
                                        ),
                                        new BigDecimal(
                                                "900.00"
                                        )
                                ),
                                new CapitalAllocationMathService.CapitalAllocationPortfolioItem(
                                        CapitalAllocationDecision.DEFER,
                                        new BigDecimal(
                                                "300.00"
                                        ),
                                        new BigDecimal(
                                                "500.00"
                                        )
                                )
                        )
                );

        assertEquals(
                new BigDecimal(
                        "600.00"
                ),
                result.fundedAmount()
        );

        assertEquals(
                new BigDecimal(
                        "400.00"
                ),
                result.remainingBudgetAmount()
        );

        assertEquals(
                new BigDecimal(
                        "60.00"
                ),
                result.budgetUtilizationPct()
        );

        assertEquals(
                new BigDecimal(
                        "500.00"
                ),
                result.opportunityCostAmount()
        );
    }
}
