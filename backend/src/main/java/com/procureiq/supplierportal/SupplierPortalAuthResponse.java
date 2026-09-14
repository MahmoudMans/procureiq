package com.procureiq.supplierportal;

import java.time.Instant;

public record SupplierPortalAuthResponse(
        String sessionToken,
        Instant expiresAt,
        SupplierPortalProfileResponse profile
) {
}
