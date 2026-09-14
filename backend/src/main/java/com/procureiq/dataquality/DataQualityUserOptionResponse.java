package com.procureiq.dataquality;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record DataQualityUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
