package com.procureiq.purchaserequest;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PurchaseRequestResponse(
        UUID id,
        String requestNumber,
        String title,
        String description,
        String businessJustification,
        UUID requesterId,
        String requesterName,
        String requesterEmail,
        UUID departmentId,
        String departmentCode,
        String departmentName,
        String costCenter,
        String currency,
        LocalDate desiredDeliveryDate,
        PurchaseRequestStatus status,
        BigDecimal estimatedTotalAmount,
        List<PurchaseRequestItemResponse> items,
        Instant submittedAt,
        Instant cancelledAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
