package com.procureiq.interventionexecution;

import java.util.UUID;

public record InterventionExecutionUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
