package com.procureiq.supplierdocument;

public record SupplierDocumentContentResponse(
        String fileName,
        String contentType,
        String sha256Checksum,
        String base64Content
) {
}
