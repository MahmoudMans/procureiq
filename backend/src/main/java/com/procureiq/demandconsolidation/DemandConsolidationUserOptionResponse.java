package com.procureiq.demandconsolidation;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record DemandConsolidationUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
