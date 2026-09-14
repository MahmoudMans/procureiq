package com.procureiq.commandcenter;

import java.math.BigDecimal;

public record CommandCenterSummaryResponse(
        long totalActions,
        long criticalActions,
        long highActions,
        long overdueActions,

        long pendingRequests,
        long rfqDeadlines,
        long overduePurchaseOrders,
        long contractComplianceIssues,
        long criticalRisks,
        long budgetExceptions,
        long upcomingDemand,
        long savingsActions,

        BigDecimal realizedSavings,
        String currency
) {
}
