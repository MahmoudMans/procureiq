package com.procureiq.suppliercollaboration;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record CollaborationUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
