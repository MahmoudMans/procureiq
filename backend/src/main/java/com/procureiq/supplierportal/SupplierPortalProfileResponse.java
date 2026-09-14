package com.procureiq.supplierportal;

import java.util.UUID;

public record SupplierPortalProfileResponse(
        UUID accountId,
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String email,
        String displayName
) {
}
