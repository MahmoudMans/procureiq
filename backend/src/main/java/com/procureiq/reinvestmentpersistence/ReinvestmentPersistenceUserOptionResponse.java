package com.procureiq.reinvestmentpersistence;

import java.util.UUID;

public record ReinvestmentPersistenceUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
