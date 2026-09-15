package com.procureiq.capacityplanning;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record CapacityUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
