package com.procureiq.sustainability;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record SustainabilityUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
