package com.procureiq.strategyrecovery;

import java.util.UUID;

public record RecoveryUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
