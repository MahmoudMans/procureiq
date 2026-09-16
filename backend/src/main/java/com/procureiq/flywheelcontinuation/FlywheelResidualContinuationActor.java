package com.procureiq.flywheelcontinuation;

import java.util.UUID;

public record FlywheelResidualContinuationActor(
        UUID id,
        String fullName,
        String role,
        boolean active
) {
}
