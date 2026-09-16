package com.procureiq.flywheelrelease;

import java.util.UUID;

public record FlywheelReleaseUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
