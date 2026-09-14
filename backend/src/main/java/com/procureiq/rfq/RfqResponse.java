package com.procureiq.rfq;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record RfqResponse(
        UUID id,
        String rfqNumber,
        UUID purchaseRequestId,
        String purchaseRequestNumber,
        String purchaseRequestTitle,
        String requesterName,
        String departmentName,
        BigDecimal purchaseRequestValue,
        String title,
        String description,
        String currency,
        LocalDateTime responseDeadline,
        RfqStatus status,
        UUID createdByUserId,
        String createdByName,
        List<RfqLineItemResponse> lineItems,
        List<RfqSupplierInvitationResponse> invitations,
        Instant publishedAt,
        Instant closedAt,
        Instant cancelledAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
