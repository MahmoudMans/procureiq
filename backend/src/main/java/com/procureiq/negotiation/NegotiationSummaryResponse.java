package com.procureiq.negotiation;

import java.math.BigDecimal;

public record NegotiationSummaryResponse(
        long totalWorkspaces,
        long draftWorkspaces,
        long activeWorkspaces,
        long agreedWorkspaces,
        long closedWorkspaces,
        long suppliersInNegotiation,
        BigDecimal baselinePipelineValue,
        BigDecimal targetSavingsOpportunity,
        BigDecimal agreedSavings,
        BigDecimal averageAgreedSavingsPct
) {
}
