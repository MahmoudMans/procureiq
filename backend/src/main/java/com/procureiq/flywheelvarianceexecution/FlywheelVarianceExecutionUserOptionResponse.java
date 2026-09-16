package com.procureiq.flywheelvarianceexecution;

import java.util.UUID;

public record FlywheelVarianceExecutionUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
