package com.procureiq.flywheelremediation;

import java.util.UUID;

public record FlywheelResidualRemediationActor(
        UUID id,
        String fullName,
        String role,
        boolean active
) {
}
