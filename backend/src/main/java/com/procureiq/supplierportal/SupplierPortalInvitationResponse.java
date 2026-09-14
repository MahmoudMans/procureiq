package com.procureiq.supplierportal;

import java.time.Instant;

public record SupplierPortalInvitationResponse(
        SupplierPortalAccountResponse account,
        String invitationToken,
        Instant invitationExpiresAt
) {
}
