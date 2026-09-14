package com.procureiq.supplierdocument;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SupplierDocumentVersionResponse(
        UUID id,
        int versionNumber,
        String originalFileName,
        String contentType,
        long fileSizeBytes,
        String sha256Checksum,
        LocalDate expiryDate,
        SupplierDocumentVersionStatus status,
        String submittedBy,
        String reviewedBy,
        String reviewNote,
        Instant reviewedAt,
        Instant createdAt
) {
}
