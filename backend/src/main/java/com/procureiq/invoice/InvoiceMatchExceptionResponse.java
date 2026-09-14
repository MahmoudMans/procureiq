package com.procureiq.invoice;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record InvoiceMatchExceptionResponse(
        UUID id,
        UUID invoiceId,
        InvoiceExceptionType exceptionType,
        InvoiceExceptionSeverity severity,
        InvoiceExceptionStatus status,
        BigDecimal expectedValue,
        BigDecimal actualValue,
        BigDecimal varianceAmount,
        String details,
        Instant detectedAt,
        Instant lastCheckedAt,
        String resolutionNote,
        Instant resolvedAt,
        String resolvedByName,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
