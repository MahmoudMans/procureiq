package com.procureiq.flywheelcontinuationrollover;

import java.util.UUID;

public record FlywheelContinuationRolloverActor(
        UUID id,
        String fullName,
        String role,
        boolean active
) {
}
