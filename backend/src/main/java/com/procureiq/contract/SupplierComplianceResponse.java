package com.procureiq.contract;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record SupplierComplianceResponse(
        UUID supplierId,
        String supplierCode,
        String supplierName,
        long trackedDocuments,
        long requiredDocuments,
        long validRequiredDocuments,
        long expiringSoonDocuments,
        long expiredDocuments,
        BigDecimal complianceScore,
        List<ComplianceDocumentResponse> documents
) {
}
