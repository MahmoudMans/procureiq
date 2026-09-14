package com.procureiq.supplierportal;

import java.time.Instant;
import java.util.UUID;

public record SupplierPortalAccountResponse(
        UUID id,
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String email,
        String displayName,
        SupplierPortalAccountStatus status,
        Instant invitationExpiresAt,
        Instant activatedAt,
        Instant lastLoginAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
