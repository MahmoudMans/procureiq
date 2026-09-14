package com.procureiq.supplierdocument;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SupplierComplianceItemResponse(
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String supplierCategory,

        UUID requirementId,
        String requirementCode,
        String requirementName,
        SupplierDocumentType documentType,
        String categoryScope,

        boolean mandatory,
        boolean expiryRequired,
        int renewalLeadDays,
        boolean onboardingRelevant,
        boolean sustainabilityRelevant,

        UUID documentId,

        SupplierDocumentEffectiveStatus effectiveStatus,

        UUID latestVersionId,
        Integer latestVersionNumber,
        String latestFileName,
        LocalDate latestExpiryDate,

        int versionCount,

        List<SupplierDocumentVersionResponse> versions
) {
}
