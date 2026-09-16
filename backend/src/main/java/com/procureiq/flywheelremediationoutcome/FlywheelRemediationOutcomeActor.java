package com.procureiq.flywheelremediationoutcome;

import java.util.UUID;

public record FlywheelRemediationOutcomeActor(
        UUID id,
        String fullName,
        String role,
        boolean active
) {
}
