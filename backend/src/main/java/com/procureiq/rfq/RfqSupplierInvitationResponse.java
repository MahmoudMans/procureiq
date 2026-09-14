package com.procureiq.rfq;

import java.time.Instant;
import java.util.UUID;

public record RfqSupplierInvitationResponse(
        UUID id,
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String category,
        String country,
        RfqInvitationStatus status,
        Instant invitedAt,
        Instant respondedAt
) {
}
