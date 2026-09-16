package com.procureiq.flywheelstrategy;

import java.util.UUID;

public record FlywheelStrategyUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
