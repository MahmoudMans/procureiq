package com.procureiq.strategyrecovery;

import java.time.Instant;
import java.util.UUID;

public record RecoveryEscalationResponse(
        UUID id,
        UUID recoveryCaseId,
        RecoveryEscalationLevel escalationLevel,
        String reason,
        String escalatedByName,
        Instant escalatedAt
) {
}
