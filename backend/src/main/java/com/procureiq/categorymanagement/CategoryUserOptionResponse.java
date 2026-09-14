package com.procureiq.categorymanagement;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record CategoryUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
