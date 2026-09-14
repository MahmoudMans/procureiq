package com.procureiq.risk;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record RiskUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
