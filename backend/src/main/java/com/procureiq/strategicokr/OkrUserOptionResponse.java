package com.procureiq.strategicokr;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record OkrUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
