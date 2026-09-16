package com.procureiq.flywheelallocation;

import java.util.UUID;

public record FlywheelAllocationUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
