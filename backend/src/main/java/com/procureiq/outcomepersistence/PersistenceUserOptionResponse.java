package com.procureiq.outcomepersistence;

import java.util.UUID;

public record PersistenceUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
