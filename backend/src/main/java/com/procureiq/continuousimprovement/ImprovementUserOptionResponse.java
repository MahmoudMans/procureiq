package com.procureiq.continuousimprovement;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record ImprovementUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
