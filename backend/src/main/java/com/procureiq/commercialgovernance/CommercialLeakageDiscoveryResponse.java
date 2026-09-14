package com.procureiq.commercialgovernance;

public record CommercialLeakageDiscoveryResponse(
        long candidatesDetected,
        long createdFindings,
        long refreshedFindings
) {
}
