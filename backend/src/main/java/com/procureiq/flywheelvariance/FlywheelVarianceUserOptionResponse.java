package com.procureiq.flywheelvariance;

import java.util.UUID;

public record FlywheelVarianceUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
