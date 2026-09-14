package com.procureiq.planning;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record PlanningUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
