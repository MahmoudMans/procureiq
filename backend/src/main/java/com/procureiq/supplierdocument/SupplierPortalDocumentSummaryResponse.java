package com.procureiq.supplierdocument;

public record SupplierPortalDocumentSummaryResponse(
        long requirements,
        long currentDocuments,
        long submittedDocuments,
        long renewalRequired,
        long expiredDocuments,
        long rejectedDocuments,
        long missingDocuments,
        boolean onboardingDocumentReady,
        boolean sustainabilityDocumentReady
) {
}
