package com.procureiq.compliance;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record ComplianceUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
