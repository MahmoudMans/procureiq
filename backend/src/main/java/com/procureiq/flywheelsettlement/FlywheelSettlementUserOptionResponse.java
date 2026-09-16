package com.procureiq.flywheelsettlement;

import java.util.UUID;

public record FlywheelSettlementUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
