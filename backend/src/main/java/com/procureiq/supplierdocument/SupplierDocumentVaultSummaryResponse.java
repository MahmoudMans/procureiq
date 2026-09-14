package com.procureiq.supplierdocument;

public record SupplierDocumentVaultSummaryResponse(
        long activeSuppliers,
        long requiredDocuments,
        long currentDocuments,
        long submittedDocuments,
        long renewalRequired,
        long expiredDocuments,
        long rejectedDocuments,
        long missingDocuments,
        long fullyCompliantSuppliers,
        long onboardingRelevantGaps,
        long sustainabilityRelevantGaps
) {
}
