package com.procureiq.controltower;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record ControlTowerUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
