package com.procureiq.contract;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ComplianceDocumentResponse(
        UUID id,
        UUID supplierId,
        UUID contractId,
        String contractNumber,
        String documentType,
        String documentName,
        String documentReference,
        boolean required,
        LocalDate issueDate,
        LocalDate expiryDate,
        ComplianceDocumentStatus status,
        long daysUntilExpiry,
        String notes,
        UUID createdByUserId,
        String createdByName,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
