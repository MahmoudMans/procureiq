package com.procureiq.anomaly;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record AnomalyUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
