package com.procureiq.flywheelcontinuationoutcome;

import java.util.UUID;

public record FlywheelContinuationOutcomeActor(
        UUID id,
        String fullName,
        String role,
        boolean active
) {
}
