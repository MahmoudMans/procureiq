package com.procureiq.portfoliooptimization;

import com.procureiq.categorymanagement.CategoryInitiativePriority;
import com.procureiq.categorymanagement.CategoryInitiativeType;
import com.procureiq.categorymanagement.CategoryMatrixPosition;

import java.math.BigDecimal;
import java.util.UUID;

public record PortfolioScenarioItemResponse(
        UUID id,
        UUID scenarioId,
        UUID initiativeId,
        String initiativeNumber,
        String categoryName,
        String initiativeTitle,
        CategoryInitiativeType initiativeType,
        CategoryInitiativePriority priority,
        CategoryMatrixPosition matrixPosition,
        PortfolioScenarioDecision decision,
        Integer rankPosition,
        BigDecimal estimatedValue,
        BigDecimal targetSavings,
        BigDecimal savingsEfficiencyPct,
        BigDecimal strategicValueScore,
        BigDecimal supplyRiskScore,
        BigDecimal priorityScore,
        BigDecimal matrixUrgencyScore,
        BigDecimal utilityScore,
        String exclusionReason
) {
}
