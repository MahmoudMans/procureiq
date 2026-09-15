package com.procureiq.interventionexecution;

import java.time.Instant;
import java.util.UUID;

public record InterventionExecutionAcknowledgementResponse(
        UUID id,
        UUID executionCaseId,
        String acknowledgementNote,
        String acknowledgedByName,
        Instant acknowledgedAt
) {
}
