package com.procureiq.savings;

public record SavingsDiscoveryResponse(
        long discoveredOpportunities,
        long createdInitiatives,
        long updatedInitiatives,
        long createdRealizations,
        long updatedRealizations
) {
}
