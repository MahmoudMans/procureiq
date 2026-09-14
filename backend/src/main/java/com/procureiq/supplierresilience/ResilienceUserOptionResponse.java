package com.procureiq.supplierresilience;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record ResilienceUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
