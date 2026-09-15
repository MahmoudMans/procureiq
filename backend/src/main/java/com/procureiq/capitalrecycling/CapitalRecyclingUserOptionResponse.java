package com.procureiq.capitalrecycling;

import java.util.UUID;

public record CapitalRecyclingUserOptionResponse(
        UUID id,
        String fullName,
        String role
) {
}
