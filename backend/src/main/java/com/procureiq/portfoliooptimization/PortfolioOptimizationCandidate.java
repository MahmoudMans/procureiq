package com.procureiq.portfoliooptimization;

import com.procureiq.categorymanagement.CategoryInitiativePriority;
import com.procureiq.categorymanagement.CategoryInitiativeType;
import com.procureiq.categorymanagement.CategoryMatrixPosition;

import java.math.BigDecimal;
import java.util.UUID;

public record PortfolioOptimizationCandidate(
        UUID initiativeId,
        String initiativeNumber,
        String categoryName,
        String title,
        CategoryInitiativeType initiativeType,
        CategoryInitiativePriority priority,
        CategoryMatrixPosition matrixPosition,
        BigDecimal estimatedValue,
        BigDecimal targetSavings,
        BigDecimal strategicValueScore,
        BigDecimal supplyRiskScore
) {
}
